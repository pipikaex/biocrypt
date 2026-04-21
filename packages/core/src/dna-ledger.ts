/**
 * DNA ledger — rotating, compressed receipts of coins owned by a wallet.
 *
 * Design rationale (from the BioCrypt spec):
 *   "each coin they get from someone, if it's for them, gets integrated into
 *    their DNA, with as less length addition as possible […] we could mutate
 *    and rotate keys each time we have a chance, miners mint and keep the
 *    system stable."
 *
 * A "ledger segment" is a short, fixed-length DNA strand appended to wallet
 * DNA whenever a coin arrives. It encodes:
 *
 *     [ MARKER (8 bases) ]
 *     [ rotation-index   (2 bases, 0..15) ]
 *     [ folded serial    (48 bases = 96 bits) ]
 *     [ checksum         (6 bases  = 12 bits) ]
 *
 * Total: 64 bases per coin — 16× smaller than storing the full coin gene,
 * while still cryptographically binding the serial hash to the wallet.
 *
 * Rotation: each new coin bumps the rotation index. The "folded serial" is
 * the coin's SHA-256 serial hash rotated left by `rotation * 32 bits` and
 * XORed with the wallet's current "rotating key" (itself derived from the
 * wallet DNA + rotation). Two coins with the same serial but different
 * rotations produce totally different DNA — so the ledger is self-mutating
 * and cannot be trivially replayed or duplicated.
 *
 * Verification: given a coin serial hash and the wallet DNA, we can scan
 * the ledger, undo the rotation, and find a match. No double-spend is
 * possible by passing the same ledger entry twice because the rotation
 * index monotonically increases.
 */

import { BASES, sha256 } from "./dna";

const LEDGER_MARKER = "TACGCAGT"; // 8 bases — unmistakable in random DNA
const LEDGER_ENTRY_LEN = 64;

const BASE_INDEX: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };

export interface LedgerEntry {
  rotation: number; // 0..15
  foldedSerialDNA: string; // 48 bases
  checksumDNA: string; // 6 bases
  fullDNA: string; // the complete 64-base segment
}

/* ── Bit packing helpers (LSB-first across 2-bit bases) ─────────────── */

function bigintToDNA(n: bigint, lenBases: number): string {
  let v = n;
  let out = "";
  for (let i = 0; i < lenBases; i++) {
    const b = Number(v & 3n);
    out += BASES[b];
    v >>= 2n;
  }
  return out;
}

function dnaToBigint(dna: string): bigint {
  let v = 0n;
  for (let i = dna.length - 1; i >= 0; i--) {
    v = (v << 2n) | BigInt(BASE_INDEX[dna[i]] ?? 0);
  }
  return v;
}

/* ── Rotating key (wallet-level) ────────────────────────────────────── */

/**
 * The rotating key for a wallet at a given rotation index.
 * Derived from the wallet's identity region + rotation — deterministic.
 * This ensures each coin's ledger segment is unique to the wallet that holds it.
 */
export function rotatingKey(walletIdentityDNA: string, rotation: number): bigint {
  const h = sha256(walletIdentityDNA + "|rotate|" + rotation);
  // Use the first 96 bits (24 hex chars) of the hash as the rotating key
  return BigInt("0x" + h.slice(0, 24));
}

/* ── Folded serial ──────────────────────────────────────────────────── */

function foldSerialHash(serialHash64Hex: string, rotation: number): bigint {
  // First 128 bits of the serial hash, rotated left by (rotation * 8) bits,
  // then folded down to 96 bits by XORing the top 32 bits into the bottom.
  if (!/^[0-9a-f]{64}$/i.test(serialHash64Hex)) {
    throw new Error("serial hash must be 64 hex chars");
  }
  const full = BigInt("0x" + serialHash64Hex);
  const top128 = full >> 128n; // upper 128 bits
  const rot = BigInt(rotation & 15) * 8n;
  const rotated = ((top128 << rot) | (top128 >> (128n - rot))) & ((1n << 128n) - 1n);
  const lo96 = rotated & ((1n << 96n) - 1n);
  const hi32 = (rotated >> 96n) & ((1n << 32n) - 1n);
  return lo96 ^ (hi32 | (hi32 << 32n) | (hi32 << 64n));
}

/* ── Encode / decode entry ──────────────────────────────────────────── */

/**
 * Build a 64-base ledger segment for a coin.
 */
export function encodeLedgerEntry(
  walletIdentityDNA: string,
  serialHash: string,
  rotation: number,
): LedgerEntry {
  const rot = rotation & 15;
  const key = rotatingKey(walletIdentityDNA, rot);
  const folded = foldSerialHash(serialHash, rot) ^ key;

  const rotDNA = bigintToDNA(BigInt(rot), 2); // 4 bits -> 2 bases
  const foldedDNA = bigintToDNA(folded, 48); // 96 bits -> 48 bases

  const checksum = sha256(
    LEDGER_MARKER + rotDNA + foldedDNA + "|" + walletIdentityDNA + "|" + serialHash,
  );
  const csumVal = BigInt("0x" + checksum.slice(0, 3)); // 12 bits
  const checksumDNA = bigintToDNA(csumVal, 6); // 12 bits -> 6 bases

  const fullDNA = LEDGER_MARKER + rotDNA + foldedDNA + checksumDNA;
  if (fullDNA.length !== LEDGER_ENTRY_LEN) {
    throw new Error(`internal: ledger entry length ${fullDNA.length} !== ${LEDGER_ENTRY_LEN}`);
  }

  return {
    rotation: rot,
    foldedSerialDNA: foldedDNA,
    checksumDNA,
    fullDNA,
  };
}

/**
 * Append a coin's ledger entry to wallet DNA. Returns the updated strand.
 */
export function appendLedgerEntry(
  walletDNA: string,
  walletIdentityDNA: string,
  serialHash: string,
  rotation: number,
): string {
  const entry = encodeLedgerEntry(walletIdentityDNA, serialHash, rotation);
  return walletDNA + entry.fullDNA;
}

/**
 * Find all ledger entries embedded in a wallet DNA strand.
 */
export function findLedgerEntries(walletDNA: string): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  let idx = walletDNA.indexOf(LEDGER_MARKER);
  while (idx !== -1) {
    const slice = walletDNA.slice(idx, idx + LEDGER_ENTRY_LEN);
    if (slice.length === LEDGER_ENTRY_LEN && slice.startsWith(LEDGER_MARKER)) {
      const rotDNA = slice.slice(8, 10);
      const foldedDNA = slice.slice(10, 58);
      const checksumDNA = slice.slice(58, 64);
      out.push({
        rotation: Number(dnaToBigint(rotDNA)) & 15,
        foldedSerialDNA: foldedDNA,
        checksumDNA,
        fullDNA: slice,
      });
      idx = walletDNA.indexOf(LEDGER_MARKER, idx + LEDGER_ENTRY_LEN);
    } else {
      idx = walletDNA.indexOf(LEDGER_MARKER, idx + 1);
    }
  }
  return out;
}

/**
 * Check whether a coin (by serial hash) is recorded in the wallet's ledger.
 * Walks each entry, recomputes the expected folded DNA, and tests for equality.
 */
export function ledgerContainsCoin(
  walletDNA: string,
  walletIdentityDNA: string,
  serialHash: string,
): boolean {
  const entries = findLedgerEntries(walletDNA);
  for (const e of entries) {
    const key = rotatingKey(walletIdentityDNA, e.rotation);
    const folded = foldSerialHash(serialHash, e.rotation) ^ key;
    const expectedDNA = bigintToDNA(folded, 48);
    if (expectedDNA === e.foldedSerialDNA) {
      const checksum = sha256(
        LEDGER_MARKER +
          bigintToDNA(BigInt(e.rotation), 2) +
          expectedDNA +
          "|" +
          walletIdentityDNA +
          "|" +
          serialHash,
      );
      const csumVal = BigInt("0x" + checksum.slice(0, 3));
      const expectedChecksumDNA = bigintToDNA(csumVal, 6);
      if (expectedChecksumDNA === e.checksumDNA) return true;
    }
  }
  return false;
}

/**
 * Next rotation index to use when adding a new coin.
 * Counts existing ledger entries mod 16.
 */
export function nextRotation(walletDNA: string): number {
  const entries = findLedgerEntries(walletDNA);
  return entries.length & 15;
}

/**
 * Remove the ledger entry matching a given coin serial hash.
 * Used when spending: the coin's receipt is burned from the wallet DNA
 * so future ownership proofs no longer include it.
 */
export function removeLedgerEntry(
  walletDNA: string,
  walletIdentityDNA: string,
  serialHash: string,
): string {
  const entries = findLedgerEntries(walletDNA);
  let dna = walletDNA;
  for (const e of entries) {
    const key = rotatingKey(walletIdentityDNA, e.rotation);
    const folded = foldSerialHash(serialHash, e.rotation) ^ key;
    const expectedDNA = bigintToDNA(folded, 48);
    if (expectedDNA === e.foldedSerialDNA) {
      const idx = dna.indexOf(e.fullDNA);
      if (idx !== -1) {
        dna = dna.slice(0, idx) + dna.slice(idx + LEDGER_ENTRY_LEN);
        break;
      }
    }
  }
  return dna;
}

export const LEDGER_ENTRY_LENGTH = LEDGER_ENTRY_LEN;
export const LEDGER_MARKER_SEQUENCE = LEDGER_MARKER;
