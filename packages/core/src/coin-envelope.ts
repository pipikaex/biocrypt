/**
 * Coin transfer envelopes for the ZBIO tracker bus.
 *
 * The tracker relays two envelope kinds between wallets:
 *
 *   - "coin-v1-transfer"  — plaintext. A full CoinV1 (+ optional parent for
 *                           batch children) plus sender metadata. Used by
 *                           early `biocrypt-transfer` releases and kept for
 *                           backwards compatibility. Anyone on the bus can
 *                           read this, and anyone with a tracker connection
 *                           who sees the envelope can attempt to claim it.
 *
 *   - "coin-v1-encrypted" — encrypted. The real payload (identical shape to
 *                           `coin-v1-transfer`) is serialised and sealed with
 *                           `encryptToDNA(plaintext, recipientEncPubKeyDNA)`.
 *                           Only the holder of the matching X25519 private
 *                           key DNA can decrypt. The outer envelope carries
 *                           just routing metadata (`toPubKeyHash`) so the
 *                           tracker can still address inbox delivery.
 *
 * A "receive address" is the recipient's `encryptionPublicKeyDNA` (128 DNA
 * bases). The sender needs the full strand; a sha256 hash of it is computed
 * by `encryptToDNA` as `DNAEnvelope.toHash` and reused here for routing.
 *
 * This file stays free of network/transport code: it's pure data + crypto.
 */

import {
  encryptToDNA, decryptFromDNA, type DNAEnvelope,
  encryptionKeyPairFromSecret,
} from "./crypto-dna";
import { sha256 } from "./dna";
import type { CoinV1 } from "./miner-sign";

/** Plaintext inner payload. */
export interface CoinTransferPayload {
  kind: "coin-v1-transfer";
  coin: CoinV1;
  /** Parent coin when transferring a batch child (required by verifyCoinV1). */
  parent?: CoinV1;
  /** Sender's miner pubkey DNA (for display / gossip attribution). */
  senderPubKeyDNA?: string;
  senderWalletId?: string;
  createdAt: number;
}

/** Outer envelope sent over the bus. */
export type CoinEnvelope =
  | (CoinTransferPayload & { toPubKeyHash: string })
  | {
      kind: "coin-v1-encrypted";
      /** Address used by the tracker for inbox delivery.
       *  Equal to sha256(recipientEncPubKeyDNA). */
      toPubKeyHash: string;
      /** Encrypted envelope produced by `encryptToDNA`. */
      sealed: DNAEnvelope;
      createdAt: number;
    };

/**
 * Seal a transfer payload for a recipient. `recipientEncPubKeyDNA` must be
 * the full 128-base X25519 public key DNA — it is NOT the short publicKeyHash.
 */
export function sealCoinEnvelope(
  payload: CoinTransferPayload,
  recipientEncPubKeyDNA: string,
): CoinEnvelope & { kind: "coin-v1-encrypted" } {
  const sealed = encryptToDNA(JSON.stringify(payload), recipientEncPubKeyDNA);
  return {
    kind: "coin-v1-encrypted",
    toPubKeyHash: sealed.toHash,
    sealed,
    createdAt: payload.createdAt,
  };
}

/**
 * Open an encrypted envelope with our X25519 private key DNA. Throws if the
 * envelope is not addressed to this key or the ciphertext has been tampered.
 */
export function openCoinEnvelope(
  env: CoinEnvelope & { kind: "coin-v1-encrypted" },
  recipientEncPrivKeyDNA: string,
): CoinTransferPayload {
  const plaintext = decryptFromDNA(env.sealed, recipientEncPrivKeyDNA);
  const parsed = JSON.parse(plaintext) as CoinTransferPayload;
  if (parsed.kind !== "coin-v1-transfer") {
    throw new Error("unexpected inner payload kind: " + (parsed as any).kind);
  }
  return parsed;
}

/**
 * Compute the routing hash for a receive address (sha256 over the 128-base
 * encryption public key DNA). This must match the `toHash` that
 * `encryptToDNA` produces so the tracker's inbox addressing lines up.
 */
export function receiveAddressHash(encryptPublicKeyDNA: string): string {
  return sha256(encryptPublicKeyDNA);
}

/**
 * Compact wire form for a "receive address" — the sender can copy this one
 * string and hand it to the UI or CLI. Format:
 *
 *   biocrypt-addr:1:<encPubKeyDNA>
 *
 * The `1` is a format version. We deliberately don't embed the short
 * publicKeyHash because it's already derivable (sha256) from the DNA strand.
 */
const ADDR_PREFIX = "biocrypt-addr:1:";

export function encodeReceiveAddress(encryptPublicKeyDNA: string): string {
  if (!/^[TACG]{128}$/.test(encryptPublicKeyDNA)) {
    throw new Error("encryption public key DNA must be 128 bases (T/A/C/G)");
  }
  return ADDR_PREFIX + encryptPublicKeyDNA;
}

/**
 * Parse a receive address. Accepts either the full `biocrypt-addr:1:...`
 * wire form or a bare 128-base DNA strand (for backwards convenience).
 */
export function parseReceiveAddress(input: string): { encryptPublicKeyDNA: string; toHash: string } {
  const trimmed = input.trim();
  let encDna: string;
  if (trimmed.startsWith(ADDR_PREFIX)) {
    encDna = trimmed.slice(ADDR_PREFIX.length);
  } else if (/^[TACG]{128}$/.test(trimmed)) {
    encDna = trimmed;
  } else {
    throw new Error("invalid receive address — expected '" + ADDR_PREFIX + "<128 DNA bases>'");
  }
  if (!/^[TACG]{128}$/.test(encDna)) {
    throw new Error("receive address encryption key must be 128 DNA bases");
  }
  return { encryptPublicKeyDNA: encDna, toHash: receiveAddressHash(encDna) };
}

/**
 * Shorthand: derive a receive address deterministically from a wallet's
 * Ed25519 signing privateKeyDNA (for wallets that pre-date encryption-key
 * persistence). Useful in migrations and in the miner CLI, which only has
 * the signing keypair today.
 */
export function deriveReceiveAddressFromPrivateKeyDNA(privateKeyDNA: string): {
  encryptPublicKeyDNA: string;
  encryptPrivateKeyDNA: string;
  address: string;
  toHash: string;
} {
  const pair = encryptionKeyPairFromSecret(privateKeyDNA);
  return {
    encryptPublicKeyDNA: pair.publicKeyDNA,
    encryptPrivateKeyDNA: pair.privateKeyDNA,
    address: encodeReceiveAddress(pair.publicKeyDNA),
    toHash: receiveAddressHash(pair.publicKeyDNA),
  };
}
