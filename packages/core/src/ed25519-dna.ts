import nacl from "tweetnacl";
import { BASES, randomBytes } from "./dna";

const BASE_INDEX: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };

/**
 * Encode raw bytes as a DNA sequence.
 * Each byte → 4 bases (2 bits per base).
 * 32 bytes → 128 bases, 64 bytes → 256 bases.
 */
export function bytesToDNA(bytes: Uint8Array): string {
  let dna = "";
  for (const byte of bytes) {
    dna += BASES[(byte >> 6) & 3];
    dna += BASES[(byte >> 4) & 3];
    dna += BASES[(byte >> 2) & 3];
    dna += BASES[byte & 3];
  }
  return dna;
}

/**
 * Decode a DNA sequence back to raw bytes.
 * 4 bases → 1 byte.
 */
export function dnaToBytes(dna: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(dna.length / 4));
  for (let i = 0; i < bytes.length; i++) {
    const o = i * 4;
    bytes[i] =
      ((BASE_INDEX[dna[o]] ?? 0) << 6) |
      ((BASE_INDEX[dna[o + 1]] ?? 0) << 4) |
      ((BASE_INDEX[dna[o + 2]] ?? 0) << 2) |
      (BASE_INDEX[dna[o + 3]] ?? 0);
  }
  return bytes;
}

export interface NetworkKeyPair {
  publicKeyDNA: string;   // 128 bases (32 bytes Ed25519 public key)
  privateKeyDNA: string;  // 128 bases (32 bytes Ed25519 seed)
}

/**
 * Generate an Ed25519 keypair encoded as DNA strands.
 * The public key DNA is the "Network Genome" (MHC markers) — shared with all wallets.
 * The private key DNA is the "Reproductive DNA" — kept secret by the network server.
 */
export function generateNetworkKeyPair(): NetworkKeyPair {
  const seed = randomBytes(32);
  const pair = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKeyDNA: bytesToDNA(pair.publicKey),
    privateKeyDNA: bytesToDNA(seed),
  };
}

/**
 * Derive Ed25519 public key DNA from private key DNA (seed).
 */
export function derivePublicKeyDNA(privateKeyDNA: string): string {
  const seed = dnaToBytes(privateKeyDNA);
  const pair = nacl.sign.keyPair.fromSeed(seed);
  return bytesToDNA(pair.publicKey);
}

/**
 * Sign arbitrary data with a private key encoded as DNA.
 * Returns the Ed25519 signature as a 256-base DNA sequence.
 */
export function signWithDNA(data: string, privateKeyDNA: string): string {
  const seed = dnaToBytes(privateKeyDNA);
  const pair = nacl.sign.keyPair.fromSeed(seed);
  const message = new TextEncoder().encode(data);
  const signature = nacl.sign.detached(message, pair.secretKey);
  return bytesToDNA(signature);
}

/**
 * Verify an Ed25519 signature encoded as DNA against a public key encoded as DNA.
 * This is the "immune recognition" — any wallet carrying the Network Genome
 * can verify any coin's signature without contacting the server.
 */
export function verifyWithDNA(
  data: string,
  signatureDNA: string,
  publicKeyDNA: string,
): boolean {
  try {
    const signature = dnaToBytes(signatureDNA);
    const publicKey = dnaToBytes(publicKeyDNA);
    if (signature.length !== 64 || publicKey.length !== 32) return false;
    const message = new TextEncoder().encode(data);
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}
