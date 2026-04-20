import {
  generateDNA, sha256, BASES, CODON_TABLE, STOP_CODONS,
} from "./dna";
import { ribosome, type Protein } from "./ribosome";
import { COIN_GENE_HEADER, integrateCoinGene } from "./wallet";
import { signWithDNA, verifyWithDNA } from "./ed25519-dna";
import {
  generateCoinRFLP, verifyRFLPFingerprint,
  type RFLPFingerprint,
} from "./rflp";
import {
  merkleRoot, merkleProof, verifyMerkleProof,
  encodeMerkleRootAsDNA, decodeMerkleRootFromDNA,
  type MerkleProofStep,
} from "./merkle";

export const DEFAULT_BODY_LENGTH = 180;

export interface MiningResult {
  coinGene: string;
  protein: Protein;
  serial: string;
  serialHash: string;
  nonce: number;
  hash: string;
  difficulty: string;
  minedAt: number;
}

export interface SignedCoin {
  coinGene: string;
  serial: string;
  serialHash: string;
  miningProof: {
    nonce: number;
    hash: string;
    difficulty: string;
  };
  networkSignature: string;
  networkId: string;
  networkGenome: string;
  rflpFingerprint?: RFLPFingerprint;
  signedAt: number;
}

/**
 * Mine a new coin by proof-of-work.
 *
 * 1. Generate a random DNA segment for the coin body
 * 2. Prepend the COIN_GENE_HEADER (ATG GGG TGG TGC)
 * 3. Append a STOP codon
 * 4. Nonce search: hash(coin gene + nonce) must start with difficulty prefix
 * 5. The nonce that satisfies difficulty is embedded into the coin body
 *    as additional codons, making the coin unique
 */
export function mineCoin(difficulty: string = "000", bodyLength: number = DEFAULT_BODY_LENGTH): MiningResult {
  const minedAt = Date.now();

  let coinBody = "";
  while (coinBody.length < bodyLength) {
    const codon = BASES[Math.floor(Math.random() * 4)]
               + BASES[Math.floor(Math.random() * 4)]
               + BASES[Math.floor(Math.random() * 4)];
    if (!STOP_CODONS.has(codon) && codon !== "ATG") {
      coinBody += codon;
    }
  }

  let nonce = 0;
  let hash = "";
  const basePayload = COIN_GENE_HEADER + coinBody;

  while (true) {
    const nonceCodons = encodeNonceAsCodons(nonce);
    const fullGene = basePayload + nonceCodons + "TAA";
    const payload = fullGene + "|" + nonce;
    hash = sha256(payload);

    if (hash.startsWith(difficulty)) {
      const coinGene = fullGene;
      const result = ribosome(coinGene);
      const protein = result.proteins[0];

      if (!protein) {
        nonce++;
        continue;
      }

      const serial = protein.aminoAcids.slice(4).join("-");

      return {
        coinGene,
        protein,
        serial,
        serialHash: sha256(serial),
        nonce,
        hash,
        difficulty,
        minedAt,
      };
    }
    nonce++;
  }
}

/**
 * Generate a random coin body (without header/stop) for use in Merkle block mining.
 */
export function generateCoinBody(bodyLength: number = DEFAULT_BODY_LENGTH): string {
  let coinBody = "";
  while (coinBody.length < bodyLength) {
    const codon = BASES[Math.floor(Math.random() * 4)]
               + BASES[Math.floor(Math.random() * 4)]
               + BASES[Math.floor(Math.random() * 4)];
    if (!STOP_CODONS.has(codon) && codon !== "ATG") {
      coinBody += codon;
    }
  }
  return coinBody;
}

/**
 * Assemble a bonus coin gene from a body (no Merkle root, just header + body + stop).
 */
export function assembleBonusCoinGene(body: string): string {
  return COIN_GENE_HEADER + body + "TAA";
}

/**
 * Assemble the primary coin gene base (header + body + Merkle root DNA).
 * The nonce codons and TAA stop are appended during PoW search.
 */
export function assemblePrimaryCoinBase(body: string, merkleRootHex: string): string {
  return COIN_GENE_HEADER + body + encodeMerkleRootAsDNA(merkleRootHex);
}

/**
 * Encode a nonce as valid DNA codons (non-STOP, non-START).
 * Each 12 bits of the nonce encodes as one codon (4^3 = 64 possibilities).
 */
export function encodeNonceAsCodons(nonce: number): string {
  let codons = "";
  let n = nonce;

  for (let i = 0; i < Math.max(2, Math.ceil(Math.log2(nonce + 2) / 6)); i++) {
    const val = n % 64;
    n = Math.floor(n / 64);
    const b0 = BASES[(val >> 4) & 3];
    const b1 = BASES[(val >> 2) & 3];
    const b2 = BASES[val & 3];
    const codon = b0 + b1 + b2;
    if (STOP_CODONS.has(codon) || codon === "ATG") {
      codons += "GCT";
    } else {
      codons += codon;
    }
  }

  return codons;
}

/**
 * Verify a mining proof using prefix-based difficulty.
 */
export function verifyMiningProof(coinGene: string, nonce: number, difficulty: string): boolean {
  const payload = coinGene + "|" + nonce;
  const hash = sha256(payload);
  return hash.startsWith(difficulty);
}

/**
 * Verify a mining proof against a 64-char hex target (Bitcoin-style).
 */
export function verifyMiningProofWithTarget(coinGene: string, nonce: number, target: string): boolean {
  const payload = coinGene + "|" + nonce;
  const hash = sha256(payload);
  return hash <= target;
}

/**
 * Convert a number of leading hex zeros into a full 64-char target string.
 */
export function leadingZerosToTarget(zeros: number): string {
  const z = Math.max(0, Math.min(63, Math.floor(zeros)));
  return "0".repeat(z) + "f".repeat(64 - z);
}

/**
 * Extract the leading-zero prefix from a 64-char hex target for display.
 */
export function targetToPrefix(target: string): string {
  let prefix = "";
  for (const c of target) {
    if (c === "0") prefix += "0";
    else break;
  }
  return prefix || "0";
}

/**
 * Sign a coin with the network's Ed25519 private key and generate RFLP proof.
 *
 * Two layers of verification:
 * 1. Ed25519 signature (mathematical proof — 256-bit security)
 * 2. RFLP fingerprint (biological proof — parentage marker DNA + gel bands)
 *
 * The coin gene is NEVER modified — mining proofs and protein serials stay
 * intact. Instead, a separate "parentage marker DNA" is generated from the
 * private key + coin serial. This marker DNA carries inherited restriction
 * sites that prove the coin was signed by this network — like mitochondrial
 * DNA inherited from the mother.
 */
export function signCoinWithNetwork(
  miningResult: MiningResult,
  networkPrivateKeyDNA: string,
  networkId: string,
  networkGenome: string,
): SignedCoin {
  const signatureData = miningResult.serialHash + "|" + networkId;
  const networkSignature = signWithDNA(signatureData, networkPrivateKeyDNA);

  const rflpFingerprint = generateCoinRFLP(networkPrivateKeyDNA, miningResult.serialHash);

  return {
    coinGene: miningResult.coinGene,
    serial: miningResult.serial,
    serialHash: miningResult.serialHash,
    miningProof: {
      nonce: miningResult.nonce,
      hash: miningResult.hash,
      difficulty: miningResult.difficulty,
    },
    networkSignature,
    networkId,
    networkGenome,
    rflpFingerprint,
    signedAt: Date.now(),
  };
}

/**
 * Verify a coin's network signature using Ed25519.
 * Works OFFLINE — only needs the network's public key DNA (genome),
 * which every wallet carries since creation.
 */
export function verifyNetworkSignature(
  coin: SignedCoin,
  networkGenome?: string,
): boolean {
  const genome = networkGenome || coin.networkGenome;
  if (!genome || !coin.networkSignature) return false;
  const signatureData = coin.serialHash + "|" + coin.networkId;
  return verifyWithDNA(signatureData, coin.networkSignature, genome);
}

/**
 * Verify a coin's RFLP fingerprint — the biological parentage test.
 * Re-digests the stored marker DNA and confirms the fragment pattern matches.
 * Returns true if the coin has a valid, consistent RFLP fingerprint.
 */
export function verifyCoinRFLP(coin: SignedCoin): boolean {
  if (!coin.rflpFingerprint) return false;
  return verifyRFLPFingerprint(coin.rflpFingerprint);
}

/**
 * Integrate a signed coin into a wallet's DNA.
 */
export function integrateCoinIntoWallet(walletDNA: string, coin: SignedCoin): string {
  return integrateCoinGene(walletDNA, coin.coinGene);
}
