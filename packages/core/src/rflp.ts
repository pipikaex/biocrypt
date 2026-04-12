import { sha256 } from "./dna";

/**
 * Restriction Fragment Length Polymorphism (RFLP) — biological coin verification.
 *
 * Real biology: restriction enzymes cut DNA at specific recognition sequences,
 * producing fragments of characteristic lengths. A child's RFLP pattern must
 * share bands with both parents (DNA fingerprinting / paternity testing).
 *
 * In Zcoin: the network is the "parent." When signing a coin (breeding),
 * the server generates a separate "parentage marker DNA" strand — think of it
 * as mitochondrial DNA inherited from the network. This strand is derived from
 * the network's private key + coin serial hash, so only the private key holder
 * can produce it. Anyone can then apply the public restriction enzymes to this
 * marker DNA to extract the fragment pattern and verify parentage.
 *
 * The original coin gene is NEVER modified — mining proofs and protein serials
 * remain intact. The marker DNA travels alongside the coin.
 */

export interface RestrictionEnzyme {
  name: string;
  site: string;        // recognition sequence (e.g. "GAATTC" for EcoRI)
  cutOffset: number;   // where within the site the cut occurs
}

/**
 * The network's public enzyme panel — analogous to the restriction enzymes
 * used in real gel electrophoresis. Everyone knows which enzymes to use;
 * security comes from the fact that only the private key holder can generate
 * the correct marker DNA that produces matching bands.
 */
export const NETWORK_ENZYMES: RestrictionEnzyme[] = [
  { name: "EcoRI",  site: "GAATTC", cutOffset: 1 },
  { name: "BamHI",  site: "GGATCC", cutOffset: 1 },
  { name: "HindIII", site: "AAGCTT", cutOffset: 1 },
  { name: "PstI",   site: "CTGCAG", cutOffset: 5 },
  { name: "SalI",   site: "GTCGAC", cutOffset: 1 },
];

export interface RFLPFingerprint {
  fragments: number[];     // sorted fragment lengths (the "gel bands")
  enzymesUsed: string[];   // which enzymes were applied
  markerCount: number;     // how many restriction sites were found
  markerDNA: string;       // the parentage marker DNA strand
}

const BASES = ["T", "A", "C", "G"] as const;

/**
 * Generate parentage marker DNA — the "mitochondrial DNA" inherited from the network.
 *
 * This is a deterministic DNA strand derived from the network's private key and
 * the coin's serial hash. Only the private key holder can produce the correct
 * marker DNA. The strand is ~180 bases long with restriction sites seeded at
 * positions derived from the hash chain.
 *
 * Steps:
 * 1. Generate a base DNA strand from SHA-256 hash chain
 * 2. Insert restriction enzyme recognition sites at deterministic positions
 * 3. The resulting marker DNA has a characteristic RFLP pattern
 */
export function generateParentageDNA(
  privateKeyDNA: string,
  coinSerialHash: string,
  length: number = 180,
): string {
  let dna = "";
  let hashIdx = 0;
  let currentHash = sha256(privateKeyDNA + "|rflp-parentage|" + coinSerialHash);

  while (dna.length < length) {
    if (hashIdx >= currentHash.length) {
      currentHash = sha256(currentHash + "|" + dna.length);
      hashIdx = 0;
    }
    const nibble = parseInt(currentHash[hashIdx], 16);
    dna += BASES[nibble % 4];
    hashIdx++;
  }

  const markerPositions = deriveMarkerPositions(dna.length, privateKeyDNA, coinSerialHash);
  let markedDNA = dna;

  for (const mp of markerPositions) {
    if (mp.position + mp.site.length <= markedDNA.length) {
      markedDNA =
        markedDNA.slice(0, mp.position) +
        mp.site +
        markedDNA.slice(mp.position + mp.site.length);
    }
  }

  return markedDNA;
}

/**
 * Derive deterministic, non-overlapping positions for restriction site insertion.
 */
function deriveMarkerPositions(
  dnaLength: number,
  privateKeyDNA: string,
  coinSerialHash: string,
): { position: number; site: string }[] {
  const targetCount = Math.max(3, Math.floor(dnaLength / 35));
  const markers: { position: number; site: string }[] = [];
  const reserved = new Set<number>();

  for (let i = 0; markers.length < targetCount && i < targetCount * 5; i++) {
    const seed = sha256(privateKeyDNA + "|rflp-pos|" + coinSerialHash + "|" + i);
    const posVal = parseInt(seed.slice(0, 8), 16);
    const enzIdx = parseInt(seed.slice(8, 10), 16) % NETWORK_ENZYMES.length;
    const enzyme = NETWORK_ENZYMES[enzIdx];
    const site = enzyme.site;

    const pos = posVal % Math.max(1, dnaLength - site.length);

    let overlap = false;
    for (let b = pos; b < pos + site.length; b++) {
      if (reserved.has(b)) { overlap = true; break; }
    }
    if (overlap) continue;

    for (let b = pos; b < pos + site.length; b++) reserved.add(b);
    markers.push({ position: pos, site });
  }

  return markers.sort((a, b) => a.position - b.position);
}

/**
 * Apply restriction enzymes to a DNA sequence and return fragment lengths.
 * This is the "gel electrophoresis" step — cut the DNA at all recognition
 * sites and measure the resulting fragments.
 */
export function digestWithEnzymes(dna: string, enzymes: RestrictionEnzyme[] = NETWORK_ENZYMES): number[] {
  if (!dna || dna.length === 0) return [];

  const cutPositions = new Set<number>();

  for (const enzyme of enzymes) {
    let idx = 0;
    while (idx <= dna.length - enzyme.site.length) {
      if (dna.slice(idx, idx + enzyme.site.length) === enzyme.site) {
        cutPositions.add(idx + enzyme.cutOffset);
        idx += enzyme.site.length;
      } else {
        idx++;
      }
    }
  }

  if (cutPositions.size === 0) return [dna.length];

  const cuts = [0, ...Array.from(cutPositions).sort((a, b) => a - b), dna.length];
  const fragments: number[] = [];
  for (let i = 1; i < cuts.length; i++) {
    const len = cuts[i] - cuts[i - 1];
    if (len > 0) fragments.push(len);
  }

  return fragments.sort((a, b) => b - a);
}

/**
 * Generate the complete RFLP fingerprint for a signed coin.
 * Creates the parentage marker DNA and digests it.
 */
export function generateCoinRFLP(
  privateKeyDNA: string,
  coinSerialHash: string,
): RFLPFingerprint {
  const markerDNA = generateParentageDNA(privateKeyDNA, coinSerialHash);
  const fragments = digestWithEnzymes(markerDNA);

  return {
    fragments,
    enzymesUsed: NETWORK_ENZYMES.map((e) => e.name),
    markerCount: Math.max(0, fragments.length - 1),
    markerDNA,
  };
}

/**
 * Verify a coin's RFLP fingerprint by re-digesting the stored marker DNA.
 * Returns true if the stored fragments match what the enzymes actually produce.
 */
export function verifyRFLPFingerprint(fingerprint: RFLPFingerprint): boolean {
  if (!fingerprint.markerDNA || fingerprint.markerDNA.length === 0) return false;
  if (fingerprint.markerCount < 2) return false;

  const recomputed = digestWithEnzymes(fingerprint.markerDNA);

  if (recomputed.length !== fingerprint.fragments.length) return false;
  for (let i = 0; i < recomputed.length; i++) {
    if (recomputed[i] !== fingerprint.fragments[i]) return false;
  }

  return true;
}

/**
 * Generate the network's reference RFLP fingerprint from the network DNA.
 * This is the "parent's DNA profile" used for visual comparison.
 */
export function generateNetworkFingerprint(networkDNA: string): RFLPFingerprint {
  const fragments = digestWithEnzymes(networkDNA);
  return {
    fragments,
    enzymesUsed: NETWORK_ENZYMES.map((e) => e.name),
    markerCount: Math.max(0, fragments.length - 1),
    markerDNA: networkDNA.slice(0, 300),
  };
}
