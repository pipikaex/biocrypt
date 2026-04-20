import { sha256 } from "./dna";

/**
 * Build a Merkle tree from an array of leaf hashes and return the root.
 * Leaves are sha256 hashes of each coin gene. If the count is odd,
 * the last leaf is duplicated (standard Bitcoin-style Merkle tree).
 */
export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return sha256("");
  let layer = leaves.map((l) => sha256("L:" + l));
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      next.push(sha256("N:" + left + right));
    }
    layer = next;
  }
  return layer[0];
}

/**
 * Generate a Merkle proof (array of {hash, position} pairs) for a leaf at `index`.
 */
export function merkleProof(
  leaves: string[],
  index: number,
): MerkleProofStep[] {
  if (leaves.length <= 1) return [];

  const proof: Array<{ hash: string; position: "left" | "right" }> = [];
  let layer = leaves.map((l) => sha256("L:" + l));
  let idx = index;

  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      next.push(sha256("N:" + left + right));

      if (i === idx || i + 1 === idx) {
        if (idx % 2 === 0) {
          const sibling = i + 1 < layer.length ? layer[i + 1] : layer[i];
          proof.push({ hash: sibling, position: "right" });
        } else {
          proof.push({ hash: layer[i], position: "left" });
        }
      }
    }
    layer = next;
    idx = Math.floor(idx / 2);
  }

  return proof;
}

export type MerkleProofStep = { hash: string; position: "left" | "right" };

/**
 * Verify a Merkle proof: given a leaf hash, proof path, and expected root.
 */
export function verifyMerkleProof(
  leafHash: string,
  proof: MerkleProofStep[],
  root: string,
): boolean {
  let current = sha256("L:" + leafHash);
  for (const step of proof) {
    if (step.position === "left") {
      current = sha256("N:" + step.hash + current);
    } else {
      current = sha256("N:" + current + step.hash);
    }
  }
  return current === root;
}

/**
 * Encode a 64-char hex Merkle root as DNA codons.
 * Each hex character (4 bits, 0-15) maps to a unique non-stop, non-start codon.
 * Uses the first 16 entries from a fixed codon alphabet.
 */
const HEX_CODONS: Record<string, string> = {
  "0": "TTT", "1": "TTC", "2": "TTA", "3": "TTG",
  "4": "TAT", "5": "TAC", "6": "TCT", "7": "TCC",
  "8": "TCA", "9": "TCG", "a": "TGT", "b": "TGC",
  "c": "TGG", "d": "CTT", "e": "CTC", "f": "CTG",
};

const CODON_HEX: Record<string, string> = {};
for (const [hex, codon] of Object.entries(HEX_CODONS)) {
  CODON_HEX[codon] = hex;
}

/**
 * Merkle root marker: 3 codons that signal "Merkle root follows"
 * (CGA CGC CGA = Arg-Arg-Arg — a unique triplet unlikely in random genes)
 */
export const MERKLE_MARKER = "CGACGCCGA";

export function encodeMerkleRootAsDNA(root: string): string {
  let dna = MERKLE_MARKER;
  for (const ch of root.toLowerCase()) {
    const codon = HEX_CODONS[ch];
    if (!codon) throw new Error(`Invalid hex char: ${ch}`);
    dna += codon;
  }
  return dna;
}

export function decodeMerkleRootFromDNA(gene: string): string | null {
  const idx = gene.indexOf(MERKLE_MARKER);
  if (idx === -1) return null;
  const start = idx + MERKLE_MARKER.length;
  if (start + 192 > gene.length) return null;

  let hex = "";
  for (let i = start; i < start + 192; i += 3) {
    const codon = gene.slice(i, i + 3);
    const h = CODON_HEX[codon];
    if (h === undefined) return null;
    hex += h;
  }
  return hex;
}
