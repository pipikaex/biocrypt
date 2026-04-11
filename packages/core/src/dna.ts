import { sha256 as jsSha256 } from "js-sha256";

export const BASES = ["T", "A", "C", "G"] as const;
export type Base = (typeof BASES)[number];

// Standard genetic code — the real human codon table.
// 64 codons map to 20 amino acids + 3 STOP signals.
export const CODON_TABLE: Record<string, string> = {
  TTT: "Phe", TTC: "Phe",
  TTA: "Leu", TTG: "Leu", CTT: "Leu", CTC: "Leu", CTA: "Leu", CTG: "Leu",
  ATT: "Ile", ATC: "Ile", ATA: "Ile",
  ATG: "Met",
  GTT: "Val", GTC: "Val", GTA: "Val", GTG: "Val",
  TCT: "Ser", TCC: "Ser", TCA: "Ser", TCG: "Ser", AGT: "Ser", AGC: "Ser",
  CCT: "Pro", CCC: "Pro", CCA: "Pro", CCG: "Pro",
  ACT: "Thr", ACC: "Thr", ACA: "Thr", ACG: "Thr",
  GCT: "Ala", GCC: "Ala", GCA: "Ala", GCG: "Ala",
  TAT: "Tyr", TAC: "Tyr",
  TAA: "STOP", TAG: "STOP", TGA: "STOP",
  CAT: "His", CAC: "His",
  CAA: "Gln", CAG: "Gln",
  AAT: "Asn", AAC: "Asn",
  AAA: "Lys", AAG: "Lys",
  GAT: "Asp", GAC: "Asp",
  GAA: "Glu", GAG: "Glu",
  TGT: "Cys", TGC: "Cys",
  TGG: "Trp",
  CGT: "Arg", CGC: "Arg", CGA: "Arg", CGG: "Arg", AGA: "Arg", AGG: "Arg",
  GGT: "Gly", GGC: "Gly", GGA: "Gly", GGG: "Gly",
};

export const START_CODON = "ATG";
export const STOP_CODONS = new Set(["TAA", "TAG", "TGA"]);

export const AMINO_PROPS: Record<string, AminoAcidProps> = {
  Ala: { charge: 0, polar: false, size: "small", hydrophobic: true, role: "structural" },
  Arg: { charge: 1, polar: true, size: "large", hydrophobic: false, role: "binding" },
  Asn: { charge: 0, polar: true, size: "medium", hydrophobic: false, role: "signaling" },
  Asp: { charge: -1, polar: true, size: "medium", hydrophobic: false, role: "catalytic" },
  Cys: { charge: 0, polar: true, size: "small", hydrophobic: false, role: "bonding" },
  Gln: { charge: 0, polar: true, size: "medium", hydrophobic: false, role: "signaling" },
  Glu: { charge: -1, polar: true, size: "medium", hydrophobic: false, role: "catalytic" },
  Gly: { charge: 0, polar: false, size: "tiny", hydrophobic: false, role: "flexible" },
  His: { charge: 0.5, polar: true, size: "medium", hydrophobic: false, role: "catalytic" },
  Ile: { charge: 0, polar: false, size: "large", hydrophobic: true, role: "structural" },
  Leu: { charge: 0, polar: false, size: "large", hydrophobic: true, role: "structural" },
  Lys: { charge: 1, polar: true, size: "large", hydrophobic: false, role: "binding" },
  Met: { charge: 0, polar: false, size: "large", hydrophobic: true, role: "initiator" },
  Phe: { charge: 0, polar: false, size: "large", hydrophobic: true, role: "structural" },
  Pro: { charge: 0, polar: false, size: "medium", hydrophobic: false, role: "structural" },
  Ser: { charge: 0, polar: true, size: "small", hydrophobic: false, role: "phosphorylation" },
  Thr: { charge: 0, polar: true, size: "medium", hydrophobic: false, role: "phosphorylation" },
  Trp: { charge: 0, polar: false, size: "large", hydrophobic: true, role: "anchoring" },
  Tyr: { charge: 0, polar: true, size: "large", hydrophobic: false, role: "phosphorylation" },
  Val: { charge: 0, polar: false, size: "medium", hydrophobic: true, role: "structural" },
};

export interface AminoAcidProps {
  charge: number;
  polar: boolean;
  size: "tiny" | "small" | "medium" | "large";
  hydrophobic: boolean;
  role: string;
}

export function generateDNA(length: number = 3000): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b: number) => BASES[b % 4]).join("");
}

export function sha256(data: string): string {
  return jsSha256(data);
}

export function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

// Complement map for base pairing (Watson-Crick)
const COMPLEMENT: Record<string, string> = { T: "A", A: "T", C: "G", G: "C" };

export function complementStrand(dna: string): string {
  return dna
    .split("")
    .map((b) => COMPLEMENT[b] || b)
    .join("");
}

// ─── Mutation operations ────────────────────────────────────────────────────────

export function mutateInsert(dna: string, position: number, sequence: string): string {
  return dna.slice(0, position) + sequence + dna.slice(position);
}

export function mutateDelete(dna: string, position: number, length: number): string {
  return dna.slice(0, position) + dna.slice(position + length);
}

export function mutateSplice(dna: string, position: number, deleteLen: number, insert: string): string {
  return dna.slice(0, position) + insert + dna.slice(position + deleteLen);
}

export function mutatePoint(dna: string, position: number, newBase: Base): string {
  return dna.slice(0, position) + newBase + dna.slice(position + 1);
}

// Find all positions of a substring in a DNA strand
export function findSequence(dna: string, target: string): number[] {
  const positions: number[] = [];
  let idx = dna.indexOf(target);
  while (idx !== -1) {
    positions.push(idx);
    idx = dna.indexOf(target, idx + 1);
  }
  return positions;
}

// Find valid insertion points: positions right after a STOP codon
export function findInsertionPoints(dna: string): number[] {
  const points: number[] = [];
  for (let i = 0; i <= dna.length - 3; i++) {
    const codon = dna.slice(i, i + 3);
    if (STOP_CODONS.has(codon)) {
      points.push(i + 3);
    }
  }
  return points;
}
