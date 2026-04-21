/**
 * Minimal RFC 6455 WebSocket framing, zero dependencies.
 * Adapted from gemix/biocrypt/packages/server/src/index.ts.
 */

import crypto from "node:crypto";
import { Buffer } from "node:buffer";

export const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
export const MAX_FRAME = 1 << 26; // 64 MB

export function wsAccept(key: string): string {
  return crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
}

export function encodeTextFrame(str: string): Buffer {
  const payload = Buffer.from(str, "utf8");
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x81;
  return Buffer.concat([header, payload]);
}

export function encodeCloseFrame(code = 1000, reason = ""): Buffer {
  const r = Buffer.from(reason, "utf8");
  const payload = Buffer.alloc(2 + r.length);
  payload.writeUInt16BE(code, 0);
  r.copy(payload, 2);
  const header = Buffer.from([0x88, payload.length]);
  return Buffer.concat([header, payload]);
}

export function encodePong(payload: Buffer): Buffer {
  const header = Buffer.from([0x8a, payload.length]);
  return Buffer.concat([header, payload]);
}

export interface ParsedFrame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
}

export function parseFrames(buffer: Buffer): {
  frames: ParsedFrame[];
  rest: Buffer;
  error?: string;
} {
  const frames: ParsedFrame[] = [];
  let off = 0;

  while (off < buffer.length) {
    if (buffer.length - off < 2) break;
    const b0 = buffer[off];
    const b1 = buffer[off + 1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7f;
    let headerLen = 2;

    if (payloadLen === 126) {
      if (buffer.length - off < 4) break;
      payloadLen = buffer.readUInt16BE(off + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (buffer.length - off < 10) break;
      const big = buffer.readBigUInt64BE(off + 2);
      if (big > BigInt(MAX_FRAME)) {
        return { frames, rest: Buffer.alloc(0), error: "frame too large" };
      }
      payloadLen = Number(big);
      headerLen = 10;
    }

    let maskLen = 0;
    let mask: Buffer | null = null;
    if (masked) {
      if (buffer.length - off < headerLen + 4) break;
      mask = buffer.subarray(off + headerLen, off + headerLen + 4);
      maskLen = 4;
    }

    const total = headerLen + maskLen + payloadLen;
    if (buffer.length - off < total) break;

    let payload = buffer.subarray(off + headerLen + maskLen, off + total);
    if (masked && mask) {
      const unmasked = Buffer.allocUnsafe(payloadLen);
      for (let i = 0; i < payloadLen; i++) unmasked[i] = payload[i] ^ mask[i & 3];
      payload = unmasked;
    }
    frames.push({ fin, opcode, payload: Buffer.from(payload) });
    off += total;
  }
  return { frames, rest: buffer.subarray(off) };
}
