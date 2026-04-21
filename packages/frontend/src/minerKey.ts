import { sha256, bytesToDNA, derivePublicKeyDNA } from "@biocrypt/core";

/**
 * Deterministically derive a v1 miner Ed25519 seed (as 128-base DNA) from a
 * wallet's privateKeyDNA. Same wallet -> same miner identity, forever.
 * Different wallets produce cryptographically independent miner keys.
 */
export function deriveMinerKey(walletPrivateKeyDNA: string): {
  privateKeyDNA: string;
  publicKeyDNA: string;
} {
  const seedHex = sha256("biocrypt-miner-v1|" + walletPrivateKeyDNA);
  const bytes = hexToBytes32(seedHex);
  const privateKeyDNA = bytesToDNA(bytes);
  const publicKeyDNA = derivePublicKeyDNA(privateKeyDNA);
  return { privateKeyDNA, publicKeyDNA };
}

function hexToBytes32(hex: string): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
