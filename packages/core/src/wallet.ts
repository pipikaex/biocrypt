import {
  generateDNA, complementStrand, sha256, randomBytes,
  mutateInsert, findInsertionPoints, BASES, START_CODON,
} from "./dna";
import { ribosome, type RibosomeResult, type Protein } from "./ribosome";

export interface Wallet {
  dna: string;
  privateKeyDNA: string;
  publicKeyHash: string;
  ownershipProofHash: string;
  createdAt: number;
}

export interface WalletView {
  publicKeyHash: string;
  proteinCount: number;
  coinCount: number;
  ribosomeResult: RibosomeResult;
}

/**
 * Coin gene marker: a specific codon pattern that identifies a gene
 * as a coin rather than structural DNA. Starts with ATG (Met) followed
 * by a "coin signature" codon pattern that the ribosome can recognize.
 * Pattern: ATG + GGG (Gly) + TGG (Trp) + TGC (Cys) = "Met-Gly-Trp-Cys" header
 */
export const COIN_GENE_HEADER = "ATGGGGTGGTGC";
export const COIN_HEADER_ACIDS = ["Met", "Gly", "Trp", "Cys"];

/**
 * Create a new wallet: generates wallet DNA + private key DNA.
 *
 * The wallet DNA contains:
 * 1. Random structural DNA (looks full even when empty)
 * 2. An ownership proof region: a section whose complement, when
 *    hybridized with the private key, produces a specific "unlocking protein"
 *
 * The private key DNA is a strand that, when combined codon-by-codon with
 * the wallet DNA's proof region, produces a deterministic protein whose
 * hash serves as proof of ownership.
 */
export function createWallet(dnaLength: number = 6000): Wallet {
  // Generate the base wallet DNA (random, looks "full")
  const baseDNA = generateDNA(dnaLength);

  // Generate private key as a separate DNA strand
  const privateKeyDNA = generateDNA(Math.floor(dnaLength / 2));

  // Derive the ownership proof using only the stable identity region (first 300 bases).
  const identityRegion = baseDNA.slice(0, 300);
  const hybridized = hybridizeStrands(identityRegion, privateKeyDNA);
  const hybridResult = ribosome(hybridized);
  const ownershipProofHash = sha256(hybridResult.publicKeyChain);

  // Embed the ownership proof hash into the wallet DNA at a known position.
  // We encode it as a codon sequence in the first 256 bases.
  const proofEmbedded = embedProofInDNA(baseDNA, ownershipProofHash);

  const walletResult = ribosome(proofEmbedded);

  return {
    dna: proofEmbedded,
    privateKeyDNA,
    publicKeyHash: walletResult.publicKeyHash,
    ownershipProofHash,
    createdAt: Date.now(),
  };
}

/**
 * Hybridize two DNA strands at codon level.
 * For each position, XOR the base indices to produce a new base.
 * This creates a deterministic third strand from any two inputs.
 */
export function hybridizeStrands(strand1: string, strand2: string): string {
  const baseIndex: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };
  const len = Math.min(strand1.length, strand2.length);
  const result: string[] = [];

  for (let i = 0; i < len; i++) {
    const idx1 = baseIndex[strand1[i]] ?? 0;
    const idx2 = baseIndex[strand2[i]] ?? 0;
    result.push(BASES[(idx1 + idx2) % 4]);
  }

  return result.join("");
}

/**
 * Embed a proof hash into the first segment of wallet DNA.
 * Each hex character is encoded as 2 bases (4 bits = 2 bases of 2 bits each).
 * Framed by a known marker so it can be located and read back.
 */
const PROOF_MARKER = "TTTAAACCCGGG"; // 12-base marker

function embedProofInDNA(dna: string, proofHash: string): string {
  const baseIdx: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };

  const hexToBases = (hex: string): string => {
    let bases = "";
    for (const ch of hex) {
      const val = parseInt(ch, 16);
      bases += BASES[(val >> 2) & 3];
      bases += BASES[val & 3];
    }
    return bases;
  };

  const proofBases = hexToBases(proofHash);
  const proofRegion = PROOF_MARKER + proofBases + PROOF_MARKER;

  if (dna.length < 300 + proofRegion.length) {
    return proofRegion + dna;
  }
  return dna.slice(0, 300) + proofRegion + dna.slice(300 + proofRegion.length);
}

/**
 * Extract the embedded proof hash from wallet DNA.
 */
export function extractEmbeddedProof(dna: string): string | null {
  const startIdx = dna.indexOf(PROOF_MARKER);
  if (startIdx === -1) return null;

  const proofStart = startIdx + PROOF_MARKER.length;
  const endIdx = dna.indexOf(PROOF_MARKER, proofStart);
  if (endIdx === -1) return null;

  const proofBases = dna.slice(proofStart, endIdx);
  const baseIndex: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };

  let hex = "";
  for (let i = 0; i < proofBases.length; i += 2) {
    const hi = baseIndex[proofBases[i]] ?? 0;
    const lo = baseIndex[proofBases[i + 1]] ?? 0;
    const val = (hi << 2) | lo;
    hex += val.toString(16);
  }

  return hex;
}

/**
 * Extract the stable identity region of wallet DNA (first 300 bases).
 * This region never changes when coins are added/removed because
 * coin genes are inserted after position 300 + proof region.
 */
function getIdentityRegion(walletDNA: string): string {
  return walletDNA.slice(0, 300);
}

/**
 * Prove ownership: combine the wallet's stable identity region
 * with the private key DNA, produce the unlocking protein.
 * This proof is stable regardless of coin mutations to the wallet.
 */
export function proveOwnership(walletDNA: string, privateKeyDNA: string): string {
  const identity = getIdentityRegion(walletDNA);
  const hybridized = hybridizeStrands(identity, privateKeyDNA);
  const result = ribosome(hybridized);
  return sha256(result.publicKeyChain);
}

/**
 * Verify ownership proof against the embedded proof in wallet DNA.
 */
export function verifyOwnership(walletDNA: string, proof: string): boolean {
  const embedded = extractEmbeddedProof(walletDNA);
  if (!embedded) return false;
  return embedded === proof;
}

/**
 * Get the public view of a wallet (no private key needed).
 */
export function viewWallet(walletDNA: string): WalletView {
  const result = ribosome(walletDNA);
  const coinCount = countCoins(walletDNA, result.proteins);

  return {
    publicKeyHash: result.publicKeyHash,
    proteinCount: result.proteins.length,
    coinCount,
    ribosomeResult: result,
  };
}

/**
 * Count coins: identify proteins that have the coin gene header.
 */
export function countCoins(walletDNA: string, proteins: Protein[]): number {
  let count = 0;
  for (const p of proteins) {
    if (isCoinProtein(p)) count++;
  }
  return count;
}

export function isCoinProtein(protein: Protein): boolean {
  if (protein.aminoAcids.length < 4) return false;
  return (
    protein.aminoAcids[0] === COIN_HEADER_ACIDS[0] &&
    protein.aminoAcids[1] === COIN_HEADER_ACIDS[1] &&
    protein.aminoAcids[2] === COIN_HEADER_ACIDS[2] &&
    protein.aminoAcids[3] === COIN_HEADER_ACIDS[3]
  );
}

/**
 * Extract a specific coin gene from wallet DNA by its serial hash.
 * Returns the gene sequence and its position so it can be removed.
 */
export function extractCoinGene(
  walletDNA: string,
  coinSerialHash: string
): { gene: string; startIdx: number; endIdx: number } | null {
  const result = ribosome(walletDNA);
  for (const protein of result.proteins) {
    if (!isCoinProtein(protein)) continue;
    const serial = getCoinSerial(protein);
    if (sha256(serial) === coinSerialHash) {
      // Gene spans from startIndex to stopIndex+1
      const endIdx = protein.stopIndex + 1;
      return {
        gene: walletDNA.slice(protein.startIndex, endIdx),
        startIdx: protein.startIndex,
        endIdx,
      };
    }
  }
  return null;
}

/**
 * Get the unique serial of a coin protein.
 * The serial is the amino acid sequence after the 4-acid header.
 */
export function getCoinSerial(protein: Protein): string {
  return protein.aminoAcids.slice(4).join("-");
}

/**
 * Integrate a coin gene into wallet DNA at a valid insertion point.
 */
export function integrateCoinGene(walletDNA: string, coinGene: string): string {
  const insertionPoints = findInsertionPoints(walletDNA);
  if (insertionPoints.length === 0) {
    // Append at end if no stop codons found
    return walletDNA + coinGene;
  }
  // Pick a deterministic insertion point based on the gene hash
  const geneHash = sha256(coinGene);
  const idx = parseInt(geneHash.slice(0, 8), 16) % insertionPoints.length;
  return mutateInsert(walletDNA, insertionPoints[idx], coinGene);
}
