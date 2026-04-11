import {
  generateDNA, sha256, BASES, CODON_TABLE, STOP_CODONS,
} from "./dna";
import { ribosome, type Protein } from "./ribosome";
import { COIN_GENE_HEADER, integrateCoinGene } from "./wallet";

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
export function mineCoin(difficulty: string = "000", bodyLength: number = 60): MiningResult {
  const minedAt = Date.now();

  // Generate random coin body codons (must be valid codons, not STOP)
  let coinBody = "";
  while (coinBody.length < bodyLength) {
    const codon = BASES[Math.floor(Math.random() * 4)]
               + BASES[Math.floor(Math.random() * 4)]
               + BASES[Math.floor(Math.random() * 4)];
    if (!STOP_CODONS.has(codon) && codon !== "ATG") {
      coinBody += codon;
    }
  }

  // Nonce search
  let nonce = 0;
  let hash = "";
  const basePayload = COIN_GENE_HEADER + coinBody;

  while (true) {
    // Encode nonce as codons and append to body
    const nonceCodons = encodeNonceAsCodons(nonce);
    const fullGene = basePayload + nonceCodons + "TAA"; // TAA = STOP
    const payload = fullGene + "|" + nonce;
    hash = sha256(payload);

    if (hash.startsWith(difficulty)) {
      // Mine the final gene with the winning nonce embedded
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
 * Encode a nonce as valid DNA codons (non-STOP, non-START).
 * Each 12 bits of the nonce encodes as one codon (4^3 = 64 possibilities).
 */
function encodeNonceAsCodons(nonce: number): string {
  let codons = "";
  let n = nonce;

  // Encode at least 2 codons (6 bases) for the nonce
  for (let i = 0; i < Math.max(2, Math.ceil(Math.log2(nonce + 2) / 6)); i++) {
    const val = n % 64;
    n = Math.floor(n / 64);
    const b0 = BASES[(val >> 4) & 3];
    const b1 = BASES[(val >> 2) & 3];
    const b2 = BASES[val & 3];
    const codon = b0 + b1 + b2;
    // Skip if it would be a STOP or START codon
    if (STOP_CODONS.has(codon) || codon === "ATG") {
      codons += "GCT"; // Ala — safe fallback
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
 * The hash must be lexicographically <= the target.
 */
export function verifyMiningProofWithTarget(coinGene: string, nonce: number, target: string): boolean {
  const payload = coinGene + "|" + nonce;
  const hash = sha256(payload);
  return hash <= target;
}

/**
 * Convert a number of leading hex zeros into a full 64-char target string.
 * e.g. 5 -> "00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
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
 * Sign a coin with network DNA.
 *
 * The network "signs" by combining network DNA with the coin to produce
 * a network-specific marker. Different networks produce different markers.
 * This marker is appended as additional codons to the coin gene.
 */
export function signCoinWithNetwork(
  miningResult: MiningResult,
  networkDNA: string,
  networkId: string,
): SignedCoin {
  // Derive network signature: hash(coin serial + network DNA segment)
  const networkSegment = networkDNA.slice(0, 300);
  const signatureInput = miningResult.serialHash + "|" + networkSegment + "|" + networkId;
  const networkSignature = sha256(signatureInput);

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
    signedAt: Date.now(),
  };
}

/**
 * Verify a coin's network signature.
 */
export function verifyNetworkSignature(
  coin: SignedCoin,
  networkDNA: string,
): boolean {
  const networkSegment = networkDNA.slice(0, 300);
  const signatureInput = coin.serialHash + "|" + networkSegment + "|" + coin.networkId;
  const expected = sha256(signatureInput);
  return expected === coin.networkSignature;
}

/**
 * Integrate a signed coin into a wallet's DNA.
 * The coin gene is inserted as-is; the network signature is metadata
 * stored alongside, not embedded in the gene itself.
 */
export function integrateCoinIntoWallet(walletDNA: string, coin: SignedCoin): string {
  return integrateCoinGene(walletDNA, coin.coinGene);
}
