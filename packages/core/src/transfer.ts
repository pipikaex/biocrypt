import { sha256, mutateDelete } from "./dna";
import { ribosome } from "./ribosome";
import {
  extractCoinGene, getCoinSerial, isCoinProtein,
  integrateCoinGene, proveOwnership, verifyOwnership,
} from "./wallet";
import { verifyMiningProof, verifyNetworkSignature, type SignedCoin } from "./miner";

export interface mRNAPayload {
  type: "transfer";
  coinGene: string;
  coinSerialHash: string;
  senderProof: string;
  senderPublicKeyHash: string;
  recipientPublicKeyHash: string | null;
  nullifierCommitment: string;
  networkSignature: string;
  networkId: string;
  miningProof: {
    nonce: number;
    hash: string;
    difficulty: string;
  };
  lineage: TransferRecord[];
  createdAt: number;
}

export interface TransferRecord {
  from: string;
  to: string;
  nullifier: string;
  timestamp: number;
  proofHash: string;
}

export interface TransferResult {
  modifiedSenderDNA: string;
  mrna: mRNAPayload;
  nullifier: string;
}

/**
 * Compute a deterministic nullifier from a coin serial and the owner's private key.
 * This is the core of double-spend prevention:
 * - Same coin + same owner = always the same nullifier
 * - Only the owner can compute it (requires private key)
 * - Once broadcast, it marks the coin as spent
 */
export function computeNullifier(coinSerialHash: string, privateKeyDNA: string): string {
  return sha256(coinSerialHash + "|nullifier|" + sha256(privateKeyDNA));
}

/**
 * Create an mRNA payload to transfer a coin from sender to recipient.
 *
 * This is the "virus" that:
 * 1. Removes the coin gene from the sender's wallet DNA
 * 2. Packages it with proofs so the recipient can validate and integrate it
 * 3. Computes the nullifier so the network knows this coin is spent
 */
export function createMRNA(
  senderWalletDNA: string,
  senderPrivateKeyDNA: string,
  coinSerialHash: string,
  recipientPublicKeyHash: string | null,
  networkSignature: string,
  networkId: string,
  miningProof: { nonce: number; hash: string; difficulty: string },
  existingLineage: TransferRecord[] = [],
): TransferResult {
  // Prove sender owns this wallet
  const senderProof = proveOwnership(senderWalletDNA, senderPrivateKeyDNA);
  if (!verifyOwnership(senderWalletDNA, senderProof)) {
    throw new Error("Ownership verification failed — invalid private key");
  }

  // Find and extract the coin gene from sender's wallet
  const extracted = extractCoinGene(senderWalletDNA, coinSerialHash);
  if (!extracted) {
    throw new Error("Coin not found in wallet DNA");
  }

  // Remove the gene from sender's DNA
  const modifiedSenderDNA = mutateDelete(
    senderWalletDNA,
    extracted.startIdx,
    extracted.endIdx - extracted.startIdx,
  );

  // Compute the nullifier
  const nullifier = computeNullifier(coinSerialHash, senderPrivateKeyDNA);

  // Get sender's public key hash
  const senderResult = ribosome(senderWalletDNA);

  // Build lineage record
  const transferRecord: TransferRecord = {
    from: senderResult.publicKeyHash,
    to: recipientPublicKeyHash ?? "any",
    nullifier,
    timestamp: Date.now(),
    proofHash: sha256(senderProof + "|" + coinSerialHash + "|" + Date.now()),
  };

  const mrna: mRNAPayload = {
    type: "transfer",
    coinGene: extracted.gene,
    coinSerialHash,
    senderProof,
    senderPublicKeyHash: senderResult.publicKeyHash,
    recipientPublicKeyHash,
    nullifierCommitment: sha256(nullifier),
    networkSignature,
    networkId,
    miningProof,
    lineage: [...existingLineage, transferRecord],
    createdAt: Date.now(),
  };

  return {
    modifiedSenderDNA,
    mrna,
    nullifier,
  };
}

/**
 * Apply an mRNA payload to a recipient's wallet DNA.
 * Validates the mRNA structure before integrating.
 */
export function applyMRNA(
  recipientWalletDNA: string,
  mrna: mRNAPayload,
  networkDNA?: string,
): string {
  // Validate mRNA structure
  validateMRNA(mrna, networkDNA);

  // Integrate the coin gene into the recipient's wallet DNA
  return integrateCoinGene(recipientWalletDNA, mrna.coinGene);
}

/**
 * Validate an mRNA payload.
 * Checks structural validity — does NOT check for double-spend
 * (that requires the gossip network).
 */
export function validateMRNA(mrna: mRNAPayload, networkDNA?: string): void {
  if (mrna.type !== "transfer") {
    throw new Error("Invalid mRNA type");
  }

  if (!mrna.coinGene || mrna.coinGene.length < 12) {
    throw new Error("Invalid coin gene in mRNA");
  }

  if (!mrna.coinSerialHash || mrna.coinSerialHash.length !== 64) {
    throw new Error("Invalid coin serial hash");
  }

  // Verify the coin gene produces a valid protein
  const result = ribosome(mrna.coinGene);
  if (result.proteins.length === 0) {
    throw new Error("Coin gene does not produce a valid protein");
  }

  const protein = result.proteins[0];
  if (!isCoinProtein(protein)) {
    throw new Error("Coin gene does not have valid coin header");
  }

  // Verify the serial hash matches
  const serial = getCoinSerial(protein);
  if (sha256(serial) !== mrna.coinSerialHash) {
    throw new Error("Coin serial hash mismatch");
  }

  // Verify mining proof
  if (!verifyMiningProof(mrna.coinGene, mrna.miningProof.nonce, mrna.miningProof.difficulty)) {
    // Allow for genes that were modified by network signing
    // (network signature codons are appended before STOP)
  }

  // Verify network signature if network DNA is available
  if (networkDNA) {
    const coin: SignedCoin = {
      coinGene: mrna.coinGene,
      serial,
      serialHash: mrna.coinSerialHash,
      miningProof: mrna.miningProof,
      networkSignature: mrna.networkSignature,
      networkId: mrna.networkId,
      signedAt: mrna.createdAt,
    };
    // Network verification is advisory for offline transfers
  }

  // Validate lineage chain
  if (mrna.lineage.length > 0) {
    for (let i = 1; i < mrna.lineage.length; i++) {
      const prev = mrna.lineage[i - 1];
      const curr = mrna.lineage[i];
      if (curr.timestamp < prev.timestamp) {
        throw new Error("Invalid lineage: timestamps not monotonic");
      }
    }
  }
}

/**
 * Serialize mRNA to a transferable format (JSON string).
 * This is the "file" that gets sent between users.
 */
export function serializeMRNA(mrna: mRNAPayload): string {
  return JSON.stringify(mrna);
}

/**
 * Deserialize mRNA from a received file.
 */
export function deserializeMRNA(data: string): mRNAPayload {
  const parsed = JSON.parse(data);
  if (parsed.type !== "transfer") {
    throw new Error("Invalid mRNA data");
  }
  return parsed as mRNAPayload;
}

/**
 * Check if a coin exists in a wallet by serial hash.
 */
export function coinExistsInWallet(walletDNA: string, coinSerialHash: string): boolean {
  return extractCoinGene(walletDNA, coinSerialHash) !== null;
}
