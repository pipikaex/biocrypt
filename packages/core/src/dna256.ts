/**
 * DNA256 codec — 256-nucleotide (TACG) fingerprints with domain separation.
 *
 * Ported from the GEMIX reference implementation
 * (/Users/daxx/Projects/Moje/gemix/lib/dna256_codec.mjs and sha256_tacg.mjs).
 *
 * Two layers share the same SHA-256 primitive but use different domain prefixes
 * so one cannot be confused for the other:
 *
 *   DNA layer  — "GEMIX:DNA256:v1:" || payload  →  display / addressing
 *   PoW layer  — "GEMIX:PoW:v1:"    || payload  →  mining target / proof
 *
 * A 256-nucleotide DNA256 strand carries 512 bits = d1 || d2 where d2 = sha256(d1),
 * then a fixed display mask is XORed in before encoding to TACG (2 bits per base).
 * Encoding: 00→T, 01→A, 10→C, 11→G (big-endian bit order within each byte).
 */

import { sha256 as jsSha256 } from "js-sha256";

const enc = new TextEncoder();

const DNA_DOMAIN = enc.encode("GEMIX:DNA256:v1:");
const POW_DOMAIN = enc.encode("GEMIX:PoW:v1:");

const BITS2 = ["T", "A", "C", "G"] as const;
const BASE_INDEX: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };

/* ── Byte / hex helpers ─────────────────────────────────────────────── */

function sha256Bytes(bytes: Uint8Array): string {
  return jsSha256(bytes);
}

function sha256HexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function concatUtf8(a: string, b: string): Uint8Array {
  const x = enc.encode(a);
  const y = enc.encode(b);
  const out = new Uint8Array(x.length + y.length);
  out.set(x, 0);
  out.set(y, x.length);
  return out;
}

function digestWithDomain(
  domainPrefix: Uint8Array,
  message: string,
  opts: { secret?: string } = {},
): string {
  const body =
    opts.secret != null && opts.secret !== ""
      ? concatUtf8(opts.secret, message)
      : enc.encode(message);
  const full = new Uint8Array(domainPrefix.length + body.length);
  full.set(domainPrefix, 0);
  full.set(body, domainPrefix.length);
  return sha256Bytes(full);
}

/* ── Public: DNA / PoW layer digests ────────────────────────────────── */

/**
 * 64-char lowercase hex digest for the **DNA display layer**.
 * Feeds `digestHexToDna256` for the visible 256-nt address strand.
 */
export function dnaLayerDigestHex(message: string, opts: { secret?: string } = {}): string {
  return digestWithDomain(DNA_DOMAIN, message, opts);
}

/**
 * 64-char lowercase hex digest for the **PoW / proof layer**.
 * Different domain prefix than the DNA layer so they cannot collide.
 */
export function powLayerDigestHex(message: string, opts: { secret?: string } = {}): string {
  return digestWithDomain(POW_DOMAIN, message, opts);
}

/* ── TACG encoding ──────────────────────────────────────────────────── */

export function bytesToDnaTacg(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    s += BITS2[(b >> 6) & 3];
    s += BITS2[(b >> 4) & 3];
    s += BITS2[(b >> 2) & 3];
    s += BITS2[b & 3];
  }
  return s;
}

export function dnaTacgToBytes(dna: string): Uint8Array {
  if (dna.length % 4 !== 0) throw new Error("DNA length must be a multiple of 4");
  const out = new Uint8Array(dna.length / 4);
  for (let i = 0, j = 0; i < dna.length; j++) {
    const v =
      ((BASE_INDEX[dna[i++]] ?? 0) << 6) |
      ((BASE_INDEX[dna[i++]] ?? 0) << 4) |
      ((BASE_INDEX[dna[i++]] ?? 0) << 2) |
      (BASE_INDEX[dna[i++]] ?? 0);
    out[j] = v;
  }
  return out;
}

/* ── Display mask (checksum'd round-trip) ───────────────────────────── */

function concat64(d1: Uint8Array, d2: Uint8Array): Uint8Array {
  const out = new Uint8Array(64);
  out.set(d1, 0);
  out.set(d2, 32);
  return out;
}

let _mix64: Uint8Array | null = null;
function mixMask64(): Uint8Array {
  if (_mix64) return _mix64;
  const label = enc.encode("gemix/dna256/display-mix/v1");
  const h0 = sha256HexToBytes(sha256Bytes(label));
  const h1 = sha256HexToBytes(sha256Bytes(h0));
  _mix64 = concat64(h0, h1);
  return _mix64;
}

function xorInPlace64(buf: Uint8Array): void {
  const m = mixMask64();
  for (let i = 0; i < 64; i++) buf[i] ^= m[i];
}

/* ── Public: 256-nt strand encoder / decoder ────────────────────────── */

/**
 * Encode a 64-char hex digest (DNA layer) into a 256-nucleotide TACG strand.
 * The strand carries d1 || sha256(d1), XOR'd with a fixed display mask.
 */
export function digestHexToDna256(hex64: string): string {
  if (!/^[0-9a-f]{64}$/.test(hex64)) {
    throw new Error("expected 64 lowercase hex characters");
  }
  const d1 = sha256HexToBytes(hex64);
  const d2 = sha256HexToBytes(sha256Bytes(d1));
  const buf = concat64(d1, d2);
  xorInPlace64(buf);
  return bytesToDnaTacg(buf);
}

/**
 * Decode a 256-nucleotide strand back to its DNA-layer 64-char hex digest.
 * Throws if the embedded `sha256(d1)` checksum does not verify.
 */
export function dna256ToDigestHex(dna256: string): string {
  if (dna256.length !== 256) throw new Error("expected 256 nucleotides");
  if (!/^[TACG]+$/i.test(dna256)) throw new Error("only T, A, C, G allowed");
  const bytes64 = dnaTacgToBytes(dna256.toUpperCase());
  xorInPlace64(bytes64);
  const d1 = bytes64.subarray(0, 32);
  const d2 = bytes64.subarray(32, 64);
  const expect = sha256HexToBytes(sha256Bytes(d1));
  for (let i = 0; i < 32; i++) {
    if (d2[i] !== expect[i]) {
      throw new Error("DNA256 checksum mismatch — not a valid strand");
    }
  }
  return bytesToHex(d1);
}

/**
 * Convenience: encode any UTF-8 message as a 256-nt DNA strand.
 * Uses the DNA display layer (not the PoW layer).
 */
export function encodeMessageToDna256(message: string, opts: { secret?: string } = {}): string {
  return digestHexToDna256(dnaLayerDigestHex(message, opts));
}

/* ── PoW primitives (nucleotide-aware difficulty) ───────────────────── */

/**
 * Full PoW-layer DNA256 strand for a given coin gene + nonce.
 * This is what the miner compares against the difficulty target.
 */
export function powLayerDna256(coinGene: string, nonce: number): string {
  const hex = powLayerDigestHex(coinGene + "|" + nonce);
  return digestHexToDna256(hex);
}

/**
 * Difficulty target in DNA256 space.
 *
 * `leadingTs` = number of `T` nucleotides the PoW-layer strand must start with.
 * T maps to the bits `00`, so each leading T = 2 leading zero bits.
 * A classic "N leading hex zeros" target corresponds to leadingTs = 2 * N.
 */
export function dnaDifficultyFromLeadingHexZeros(hexZeros: number): number {
  return Math.max(0, Math.min(256, Math.floor(hexZeros) * 2));
}

/**
 * Format a DNA difficulty as a display target string (all `T`s followed by `.`s).
 */
export function formatDnaTarget(leadingTs: number): string {
  const t = Math.max(0, Math.min(256, leadingTs));
  return "T".repeat(t) + ".".repeat(256 - t);
}

/**
 * Count how many leading `T` characters a candidate DNA256 strand has.
 */
export function countLeadingTs(dna256: string): number {
  let n = 0;
  for (let i = 0; i < dna256.length; i++) {
    if (dna256[i] !== "T") break;
    n++;
  }
  return n;
}

/**
 * Verify a DNA256 mining proof against a "leading T" difficulty.
 * The PoW digest is deterministic for a given coinGene + nonce; the
 * resulting 256-nt strand must start with `leadingTs` Ts to be valid.
 */
export function verifyDna256MiningProof(
  coinGene: string,
  nonce: number,
  leadingTs: number,
): boolean {
  const strand = powLayerDna256(coinGene, nonce);
  return countLeadingTs(strand) >= leadingTs;
}
