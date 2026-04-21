/**
 * Encrypt-to-DNA envelope protocol.
 *
 * Inspired by the RSA-over-DNA design used by `chat.biocrypt.net`, but built
 * on NaCl's X25519 + XSalsa20-Poly1305 (`box`) instead of RSA — same public
 * semantics, ~100× faster, modern security margin.
 *
 * Wire form is a JSON object in which every cryptographic byte-field is
 * encoded as a DNA string (T/A/C/G). This is what the protocol calls
 * "DNA-native" transport: the ciphertext, nonce, and ephemeral public key
 * are all just strands of nucleotides. No base64, no hex on the wire.
 *
 *   envelope = {
 *     v: 1,
 *     to: recipientPublicKeyDNA,          // 128 bases   (X25519 public key)
 *     eph: ephemeralPublicKeyDNA,         // 128 bases   (X25519 ephemeral)
 *     nonce: nonceDNA,                    //  96 bases   (24-byte secretbox nonce)
 *     body: ciphertextDNA,                // 4 bases per byte
 *   }
 */

import nacl from "tweetnacl";
import { BASES, randomBytes, sha256 } from "./dna";

const BASE_INDEX: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };
const enc = new TextEncoder();
const dec = new TextDecoder();

/* ── Bytes ↔ DNA (2-bits-per-base, same mapping as ed25519-dna) ────── */

export function bytesToDNABox(bytes: Uint8Array): string {
  let dna = "";
  for (const byte of bytes) {
    dna += BASES[(byte >> 6) & 3];
    dna += BASES[(byte >> 4) & 3];
    dna += BASES[(byte >> 2) & 3];
    dna += BASES[byte & 3];
  }
  return dna;
}

export function dnaToBytesBox(dna: string): Uint8Array {
  if (dna.length % 4 !== 0) throw new Error("DNA length must be a multiple of 4");
  const bytes = new Uint8Array(dna.length / 4);
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

/* ── Encryption keypair ────────────────────────────────────────────── */

export interface EncryptionKeyPair {
  publicKeyDNA: string; // 128 bases
  privateKeyDNA: string; // 128 bases (32 bytes secret)
}

/**
 * Generate a fresh X25519 encryption keypair encoded as DNA.
 */
export function generateEncryptionKeyPair(): EncryptionKeyPair {
  const pair = nacl.box.keyPair();
  return {
    publicKeyDNA: bytesToDNABox(pair.publicKey),
    privateKeyDNA: bytesToDNABox(pair.secretKey),
  };
}

/**
 * Derive an X25519 encryption keypair deterministically from 32-byte seed bytes.
 * Used by the DNA-seeded wallet minter so a wallet DNA phrase can regenerate
 * the same encryption identity forever.
 */
export function encryptionKeyPairFromSeed(seed32: Uint8Array): EncryptionKeyPair {
  if (seed32.length !== 32) throw new Error("seed must be 32 bytes");
  const pair = nacl.box.keyPair.fromSecretKey(seed32);
  return {
    publicKeyDNA: bytesToDNABox(pair.publicKey),
    privateKeyDNA: bytesToDNABox(seed32),
  };
}

/**
 * Derive the public key DNA from a private key DNA (X25519 secret).
 */
export function deriveEncryptionPublicKeyDNA(privateKeyDNA: string): string {
  const sk = dnaToBytesBox(privateKeyDNA);
  const pair = nacl.box.keyPair.fromSecretKey(sk);
  return bytesToDNABox(pair.publicKey);
}

/**
 * Derive an X25519 encryption keypair from any stable secret DNA string
 * (e.g. an Ed25519 signing privateKeyDNA). Used to migrate wallets that
 * were minted before encryption keys were persisted.
 *
 * The input is hashed to 32 bytes; the hash is used as the X25519 secret
 * directly. Given the same input, the output is identical forever.
 */
export function encryptionKeyPairFromSecret(secret: string): EncryptionKeyPair {
  const hashHex = sha256("biocrypt|enc-seed|" + secret);
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    seed[i] = parseInt(hashHex.slice(i * 2, i * 2 + 2), 16);
  }
  return encryptionKeyPairFromSeed(seed);
}

/* ── Envelope ──────────────────────────────────────────────────────── */

export interface DNAEnvelope {
  v: 1;
  to: string; // recipient X25519 public key DNA (128 bases)
  eph: string; // ephemeral X25519 public key DNA (128 bases)
  nonce: string; // 24-byte nonce as DNA (96 bases)
  body: string; // ciphertext as DNA (4 bases per byte)
  /** fingerprint of recipient pubkey for gossip-level addressing */
  toHash: string;
}

/**
 * Encrypt a plaintext string to a recipient's public key DNA.
 * Uses a fresh ephemeral keypair — forward secrecy against single-message compromise.
 */
export function encryptToDNA(plaintext: string, recipientPubKeyDNA: string): DNAEnvelope {
  const recipientPk = dnaToBytesBox(recipientPubKeyDNA);
  if (recipientPk.length !== 32) {
    throw new Error("recipient public key must decode to 32 bytes");
  }

  const ephemeral = nacl.box.keyPair();
  const nonce = randomBytes(nacl.box.nonceLength); // 24 bytes
  const msg = enc.encode(plaintext);
  const ciphertext = nacl.box(msg, nonce, recipientPk, ephemeral.secretKey);

  return {
    v: 1,
    to: recipientPubKeyDNA,
    eph: bytesToDNABox(ephemeral.publicKey),
    nonce: bytesToDNABox(nonce),
    body: bytesToDNABox(ciphertext),
    toHash: sha256(recipientPubKeyDNA),
  };
}

/**
 * Decrypt an envelope using a private key DNA.
 * Returns the plaintext or throws if the envelope is not for this key / is tampered.
 */
export function decryptFromDNA(envelope: DNAEnvelope, privateKeyDNA: string): string {
  if (envelope.v !== 1) throw new Error("unsupported envelope version");
  const sk = dnaToBytesBox(privateKeyDNA);
  if (sk.length !== 32) throw new Error("private key must decode to 32 bytes");

  const ourPub = nacl.box.keyPair.fromSecretKey(sk).publicKey;
  const ourPubDNA = bytesToDNABox(ourPub);
  if (ourPubDNA !== envelope.to) {
    throw new Error("envelope is not addressed to this key");
  }

  const ephPub = dnaToBytesBox(envelope.eph);
  const nonce = dnaToBytesBox(envelope.nonce);
  const ct = dnaToBytesBox(envelope.body);

  const plain = nacl.box.open(ct, nonce, ephPub, sk);
  if (!plain) throw new Error("decryption failed (tampered or wrong key)");
  return dec.decode(plain);
}

/**
 * Cheap predicate: can a given public key DNA open this envelope?
 * Useful for incoming queues where the recipient scans many envelopes.
 */
export function envelopeAddressedTo(envelope: DNAEnvelope, publicKeyDNA: string): boolean {
  return envelope.to === publicKeyDNA;
}

/**
 * Serialize / deserialize for storage & transport (plain JSON).
 */
export function serializeEnvelope(env: DNAEnvelope): string {
  return JSON.stringify(env);
}

export function deserializeEnvelope(data: string): DNAEnvelope {
  const parsed = JSON.parse(data) as DNAEnvelope;
  if (parsed.v !== 1 || !parsed.to || !parsed.eph || !parsed.nonce || !parsed.body) {
    throw new Error("invalid envelope format");
  }
  return parsed;
}
