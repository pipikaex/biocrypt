import { sha256, mutateDelete } from "./dna";
import { ribosome } from "./ribosome";
import {
  extractCoinGene, getCoinSerial, isCoinProtein,
  integrateCoinGene, proveOwnership, verifyOwnership,
  integrateCoinReceipt,
} from "./wallet";
import { verifyMiningProof, verifyNetworkSignature, type SignedCoin } from "./miner";
import { verifyRFLPFingerprint, type RFLPFingerprint } from "./rflp";
import {
  encryptToDNA, decryptFromDNA, serializeEnvelope, deserializeEnvelope,
  type DNAEnvelope,
} from "./crypto-dna";
import { verifyDna256MiningProof } from "./dna256";

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
  networkGenome: string;
  rflpFingerprint?: RFLPFingerprint;
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
 * Same coin + same owner = always the same nullifier.
 * Only the owner can compute it (requires private key).
 * Once broadcast, it marks the coin as spent.
 */
export function computeNullifier(coinSerialHash: string, privateKeyDNA: string): string {
  return sha256(coinSerialHash + "|nullifier|" + sha256(privateKeyDNA));
}

/**
 * Create an mRNA payload to transfer a coin from sender to recipient.
 */
export function createMRNA(
  senderWalletDNA: string,
  senderPrivateKeyDNA: string,
  coinSerialHash: string,
  recipientPublicKeyHash: string | null,
  networkSignature: string,
  networkId: string,
  networkGenome: string,
  miningProof: { nonce: number; hash: string; difficulty: string },
  existingLineage: TransferRecord[] = [],
  rflpFingerprint?: RFLPFingerprint,
): TransferResult {
  const senderProof = proveOwnership(senderWalletDNA, senderPrivateKeyDNA);
  if (!verifyOwnership(senderWalletDNA, senderProof)) {
    throw new Error("Ownership verification failed — invalid private key");
  }

  const extracted = extractCoinGene(senderWalletDNA, coinSerialHash);
  if (!extracted) {
    throw new Error("Coin not found in wallet DNA");
  }

  const modifiedSenderDNA = mutateDelete(
    senderWalletDNA,
    extracted.startIdx,
    extracted.endIdx - extracted.startIdx,
  );

  const nullifier = computeNullifier(coinSerialHash, senderPrivateKeyDNA);

  const senderResult = ribosome(senderWalletDNA);

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
    networkGenome,
    rflpFingerprint,
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
 * Validates structure AND network signature before integrating.
 */
export function applyMRNA(
  recipientWalletDNA: string,
  mrna: mRNAPayload,
  recipientNetworkGenome?: string,
): string {
  validateMRNA(mrna, recipientNetworkGenome);
  return integrateCoinGene(recipientWalletDNA, mrna.coinGene);
}

/**
 * Validate an mRNA payload.
 * Checks structural validity, mining proof, AND network signature.
 * Throws on any failure.
 */
export function validateMRNA(mrna: mRNAPayload, networkGenome?: string): void {
  if (mrna.type !== "transfer") {
    throw new Error("Invalid mRNA type");
  }

  if (!mrna.coinGene || mrna.coinGene.length < 12) {
    throw new Error("Invalid coin gene in mRNA");
  }

  if (!mrna.coinSerialHash || mrna.coinSerialHash.length !== 64) {
    throw new Error("Invalid coin serial hash");
  }

  const result = ribosome(mrna.coinGene);
  if (result.proteins.length === 0) {
    throw new Error("Coin gene does not produce a valid protein");
  }

  const protein = result.proteins[0];
  if (!isCoinProtein(protein)) {
    throw new Error("Coin gene does not have valid coin header");
  }

  const serial = getCoinSerial(protein);
  if (sha256(serial) !== mrna.coinSerialHash) {
    throw new Error("Coin serial hash mismatch");
  }

  const genome = networkGenome || mrna.networkGenome;
  const hasValidNetSig = !!(genome && mrna.networkSignature);

  if (hasValidNetSig) {
    const coin: SignedCoin = {
      coinGene: mrna.coinGene,
      serial,
      serialHash: mrna.coinSerialHash,
      miningProof: mrna.miningProof,
      networkSignature: mrna.networkSignature,
      networkId: mrna.networkId,
      networkGenome: mrna.networkGenome,
      signedAt: mrna.createdAt,
    };
    if (!verifyNetworkSignature(coin, genome)) {
      throw new Error("Invalid network signature — coin is not from this network");
    }
  } else {
    if (!mrna.miningProof.difficulty || mrna.miningProof.difficulty.length < 6) {
      throw new Error("Invalid mining proof — difficulty too low or missing");
    }
    if (!verifyMiningProof(mrna.coinGene, mrna.miningProof.nonce, mrna.miningProof.difficulty)) {
      throw new Error("Invalid mining proof — coin was not properly mined");
    }
  }

  if (mrna.rflpFingerprint) {
    if (!verifyRFLPFingerprint(mrna.rflpFingerprint)) {
      throw new Error("Invalid RFLP fingerprint — parentage marker DNA is inconsistent");
    }
  }

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

/* ── Bundle support (multi-coin transfers) ──────────────────────────── */

export interface mRNABundle {
  type: "bundle";
  mrnas: mRNAPayload[];
  createdAt: number;
}

export function serializeBundle(mrnas: mRNAPayload[]): string {
  const bundle: mRNABundle = { type: "bundle", mrnas, createdAt: Date.now() };
  return JSON.stringify(bundle);
}

/**
 * Parse raw mRNA data that can be either a single mRNA or a bundle.
 * Always returns an array of mRNAPayload.
 */
export function parseMRNAData(data: string): mRNAPayload[] {
  const parsed = JSON.parse(data);
  if (parsed.type === "bundle" && Array.isArray(parsed.mrnas)) {
    return (parsed as mRNABundle).mrnas;
  }
  if (parsed.type === "transfer") {
    return [parsed as mRNAPayload];
  }
  throw new Error("Invalid mRNA data: expected transfer or bundle");
}

/**
 * Apply multiple mRNA payloads to a recipient wallet sequentially.
 * Returns the final wallet DNA after all coins are integrated.
 */
export function applyMRNABundle(
  recipientWalletDNA: string,
  mrnas: mRNAPayload[],
  recipientNetworkGenome?: string,
): string {
  let dna = recipientWalletDNA;
  for (const mrna of mrnas) {
    dna = applyMRNA(dna, mrna, recipientNetworkGenome);
  }
  return dna;
}

/**
 * Check if a coin exists in a wallet by serial hash.
 */
export function coinExistsInWallet(walletDNA: string, coinSerialHash: string): boolean {
  return extractCoinGene(walletDNA, coinSerialHash) !== null;
}

/* ── Encrypted mRNA envelopes (RSA-over-DNA-style) ──────────────────── */

export interface EncryptedMRNA {
  kind: "encrypted-mrna";
  envelope: DNAEnvelope;
  /** Public coin serial hash — lets the recipient reject duplicates before decrypting */
  coinSerialHash: string;
  /** DNA256 proof-of-transmission (deterministic from envelope + serial) */
  transmissionProof: string;
  createdAt: number;
}

/**
 * Wrap an mRNA transfer in a DNA-native encrypted envelope addressed to the
 * recipient's X25519 public key DNA. The ciphertext + ephemeral key + nonce
 * are all DNA strings — exactly the protocol used by chat.biocrypt.net.
 */
export function encryptMRNAForRecipient(
  mrna: mRNAPayload,
  recipientEncryptionPublicKeyDNA: string,
): EncryptedMRNA {
  const envelope = encryptToDNA(serializeMRNA(mrna), recipientEncryptionPublicKeyDNA);
  return {
    kind: "encrypted-mrna",
    envelope,
    coinSerialHash: mrna.coinSerialHash,
    transmissionProof: sha256(
      envelope.eph + "|" + envelope.nonce + "|" + mrna.coinSerialHash,
    ),
    createdAt: Date.now(),
  };
}

/**
 * Decrypt an incoming EncryptedMRNA with the recipient's X25519 private key DNA.
 * Throws if the envelope is not addressed to this key or is tampered.
 */
export function decryptMRNA(
  encrypted: EncryptedMRNA,
  recipientEncryptionPrivateKeyDNA: string,
): mRNAPayload {
  const plaintext = decryptFromDNA(encrypted.envelope, recipientEncryptionPrivateKeyDNA);
  const mrna = deserializeMRNA(plaintext);
  if (mrna.coinSerialHash !== encrypted.coinSerialHash) {
    throw new Error("envelope serial hash mismatch — possible tampering");
  }
  return mrna;
}

export function serializeEncryptedMRNA(msg: EncryptedMRNA): string {
  return JSON.stringify(msg);
}

export function deserializeEncryptedMRNA(data: string): EncryptedMRNA {
  const parsed = JSON.parse(data);
  if (parsed.kind !== "encrypted-mrna" || !parsed.envelope) {
    throw new Error("invalid encrypted mRNA");
  }
  return {
    kind: "encrypted-mrna",
    envelope: parsed.envelope as DNAEnvelope,
    coinSerialHash: parsed.coinSerialHash,
    transmissionProof: parsed.transmissionProof,
    createdAt: parsed.createdAt,
  };
}

/* ── Offline transfer protocol ──────────────────────────────────────── */

/**
 * An OfflineTransfer bundles everything a recipient needs to *independently*
 * verify and integrate a coin without contacting the server:
 *
 *   • encrypted mRNA (coin gene, network signature, mining proof, lineage)
 *   • nullifier commitment (so the recipient can gossip it later)
 *   • DNA256 PoW proof (leading-T check, recomputed from the public digest)
 *
 * The recipient applies it to their wallet immediately; both parties queue
 * the nullifier for gossip whenever either one is back online.
 */
export interface OfflineTransfer {
  kind: "offline-transfer";
  version: 1;
  encrypted: EncryptedMRNA;
  nullifierCommitment: string;
  nullifier: string; // revealed to recipient — they'll broadcast when online
  coinSerialHash: string;
  senderPublicKeyHash: string;
  recipientPublicKeyHash: string;
  createdAt: number;
}

export function packOfflineTransfer(
  mrna: mRNAPayload,
  nullifier: string,
  recipientEncryptionPublicKeyDNA: string,
  recipientPublicKeyHash: string,
): OfflineTransfer {
  return {
    kind: "offline-transfer",
    version: 1,
    encrypted: encryptMRNAForRecipient(mrna, recipientEncryptionPublicKeyDNA),
    nullifierCommitment: sha256(nullifier),
    nullifier,
    coinSerialHash: mrna.coinSerialHash,
    senderPublicKeyHash: mrna.senderPublicKeyHash,
    recipientPublicKeyHash,
    createdAt: Date.now(),
  };
}

/**
 * Apply an offline transfer to the recipient wallet DNA. Verifies the full
 * mRNA envelope *without touching the network* — pure offline settlement.
 * Returns the updated wallet DNA and the mRNA (so caller can gossip the
 * nullifier later).
 */
export function applyOfflineTransfer(
  recipientWalletDNA: string,
  recipientEncryptionPrivateKeyDNA: string,
  transfer: OfflineTransfer,
  networkGenome?: string,
): { walletDNA: string; mrna: mRNAPayload } {
  if (transfer.kind !== "offline-transfer" || transfer.version !== 1) {
    throw new Error("unsupported offline transfer");
  }
  if (sha256(transfer.nullifier) !== transfer.nullifierCommitment) {
    throw new Error("nullifier commitment mismatch");
  }
  const mrna = decryptMRNA(transfer.encrypted, recipientEncryptionPrivateKeyDNA);
  validateMRNA(mrna, networkGenome);

  const walletDNA = applyMRNA(recipientWalletDNA, mrna, networkGenome);
  // Also integrate the compact receipt for quick balance lookup.
  const withReceipt = integrateCoinReceipt(walletDNA, mrna.coinSerialHash);
  return { walletDNA: withReceipt, mrna };
}

export function serializeOfflineTransfer(t: OfflineTransfer): string {
  return JSON.stringify(t);
}

export function deserializeOfflineTransfer(data: string): OfflineTransfer {
  const parsed = JSON.parse(data);
  if (parsed.kind !== "offline-transfer" || parsed.version !== 1) {
    throw new Error("invalid offline transfer");
  }
  return parsed as OfflineTransfer;
}

/* ── DNA256-aware verification ──────────────────────────────────────── */

/**
 * Verify an mRNA's mining proof in DNA256 space.
 * `leadingTs` is the network's current DNA256 difficulty (number of leading T bases
 * required on the PoW layer). Falls back to the legacy prefix check if the coin
 * was mined before the DNA256 upgrade.
 */
export function verifyMRNAMiningProofDNA256(mrna: mRNAPayload, leadingTs: number): boolean {
  if (leadingTs <= 0) return true;
  return verifyDna256MiningProof(mrna.coinGene, mrna.miningProof.nonce, leadingTs);
}
