/**
 * PNG Steganography module.
 *
 * Encodes wallet DNA and metadata into PNG images using nibble-in-channel
 * encoding (adapted from Hypercoin's coinex.js).
 *
 * Each byte is split into two 4-bit nibbles. Each nibble is stored as
 * 128 + nibble in one RGB channel. Other channels get random noise.
 * This makes the image look like colorful static while carrying data.
 *
 * This module provides pure encode/decode of the byte stream.
 * Actual Canvas/PNG rendering is handled by platform-specific code
 * (Node canvas or browser Canvas).
 */

export interface WalletPNGPayload {
  version: number;
  walletDNA: string;
  publicKeyHash: string;
  ownershipProofHash: string;
  coinCount: number;
  createdAt: number;
}

export type Channel = "R" | "G" | "B";

/**
 * Serialize a wallet payload into a byte array for PNG encoding.
 * Layout (all lengths are 4-byte big-endian):
 *
 * [4] version
 * [4] walletDNA length
 * [N] walletDNA as ASCII
 * [4] publicKeyHash length
 * [N] publicKeyHash as ASCII
 * [4] ownershipProofHash length
 * [N] ownershipProofHash as ASCII
 * [4] coinCount
 * [8] createdAt (as two 4-byte ints: hi, lo)
 */
export function serializePayload(payload: WalletPNGPayload): Uint8Array {
  const dnaBytes = new TextEncoder().encode(payload.walletDNA);
  const pubBytes = new TextEncoder().encode(payload.publicKeyHash);
  const proofBytes = new TextEncoder().encode(payload.ownershipProofHash);

  const totalSize = 4 + 4 + dnaBytes.length + 4 + pubBytes.length
                  + 4 + proofBytes.length + 4 + 8;

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);
  let offset = 0;

  const write32 = (val: number) => { view.setUint32(offset, val); offset += 4; };
  const writeBytes = (bytes: Uint8Array) => { buf.set(bytes, offset); offset += bytes.length; };

  write32(payload.version);
  write32(dnaBytes.length);
  writeBytes(dnaBytes);
  write32(pubBytes.length);
  writeBytes(pubBytes);
  write32(proofBytes.length);
  writeBytes(proofBytes);
  write32(payload.coinCount);
  write32(Math.floor(payload.createdAt / 0x100000000));
  write32(payload.createdAt & 0xFFFFFFFF);

  return buf;
}

/**
 * Deserialize a byte array back to a wallet payload.
 */
export function deserializePayload(buf: Uint8Array): WalletPNGPayload {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 0;

  const read32 = (): number => { const v = view.getUint32(offset); offset += 4; return v; };
  const readBytes = (len: number): Uint8Array => { const b = buf.slice(offset, offset + len); offset += len; return b; };

  const version = read32();
  const dnaLen = read32();
  const walletDNA = new TextDecoder().decode(readBytes(dnaLen));
  const pubLen = read32();
  const publicKeyHash = new TextDecoder().decode(readBytes(pubLen));
  const proofLen = read32();
  const ownershipProofHash = new TextDecoder().decode(readBytes(proofLen));
  const coinCount = read32();
  const hi = read32();
  const lo = read32();
  const createdAt = hi * 0x100000000 + lo;

  return { version, walletDNA, publicKeyHash, ownershipProofHash, coinCount, createdAt };
}

/**
 * Encode a byte array into RGBA pixel data using nibble-in-channel encoding.
 * Returns pixel data and the required canvas side length.
 */
export function encodeToPixels(
  data: Uint8Array,
  channel: Channel = "R",
): { pixels: Uint8Array; side: number } {
  const pixelsNeeded = data.length * 2; // 2 pixels per byte
  const side = Math.ceil(Math.sqrt(pixelsNeeded));
  const totalPixels = side * side;
  const pixels = new Uint8Array(totalPixels * 4); // RGBA

  const channelIdx = channel === "R" ? 0 : channel === "G" ? 1 : 2;

  // Fill with random noise first
  for (let i = 0; i < totalPixels; i++) {
    const base = i * 4;
    pixels[base] = 128 + Math.floor(Math.random() * 128);     // R
    pixels[base + 1] = 128 + Math.floor(Math.random() * 128); // G
    pixels[base + 2] = 128 + Math.floor(Math.random() * 128); // B
    pixels[base + 3] = 255; // A
  }

  // Encode data
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    const hiNibble = (byte >> 4) & 0x0F;
    const loNibble = byte & 0x0F;

    const px1 = (i * 2) * 4;
    const px2 = (i * 2 + 1) * 4;

    // Set the chosen channel to 128 + nibble
    pixels[px1 + channelIdx] = 128 + hiNibble;
    pixels[px2 + channelIdx] = 128 + loNibble;
  }

  return { pixels, side };
}

/**
 * Decode RGBA pixel data back to a byte array.
 */
export function decodeFromPixels(
  pixels: Uint8Array,
  dataLength: number,
  channel: Channel = "R",
): Uint8Array {
  const channelIdx = channel === "R" ? 0 : channel === "G" ? 1 : 2;
  const data = new Uint8Array(dataLength);

  for (let i = 0; i < dataLength; i++) {
    const px1 = (i * 2) * 4;
    const px2 = (i * 2 + 1) * 4;

    const hiNibble = (pixels[px1 + channelIdx] - 128) & 0x0F;
    const loNibble = (pixels[px2 + channelIdx] - 128) & 0x0F;

    data[i] = (hiNibble << 4) | loNibble;
  }

  return data;
}

/**
 * Full encode: wallet payload -> pixel data ready for Canvas.
 * Prepends a 4-byte length header so the decoder knows how many bytes to read.
 */
export function encodeWalletToPixels(
  payload: WalletPNGPayload,
  channel: Channel = "R",
): { pixels: Uint8Array; side: number } {
  const serialized = serializePayload(payload);

  // Prepend length
  const withLength = new Uint8Array(4 + serialized.length);
  new DataView(withLength.buffer).setUint32(0, serialized.length);
  withLength.set(serialized, 4);

  return encodeToPixels(withLength, channel);
}

/**
 * Full decode: pixel data -> wallet payload.
 */
export function decodeWalletFromPixels(
  pixels: Uint8Array,
  channel: Channel = "R",
): WalletPNGPayload {
  // Read length header (first 4 bytes = 8 pixels)
  const lengthBytes = decodeFromPixels(pixels, 4, channel);
  const dataLength = new DataView(lengthBytes.buffer).getUint32(0);

  // Read payload
  const allBytes = decodeFromPixels(pixels, 4 + dataLength, channel);
  const payloadBytes = allBytes.slice(4);

  return deserializePayload(payloadBytes);
}
