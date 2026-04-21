#!/usr/bin/env node
// biocrypt-transfer — move BioCrypt v1 coins from a miner wallet to another
// wallet's public key hash.
//
// The miner wallet (`~/.biocrypt/miner-wallet.json`) holds the raw keypair
// (`publicKeyDNA` / `privateKeyDNA`) that signed each coin's `minerPubKeyDNA`.
// The frontend wallet uses a DNA-strand wallet format and the UI's Transfer
// page therefore cannot consume a miner wallet directly. This CLI fills that
// gap: it fetches the coins owned by a miner key from the tracker, computes
// a nullifier with the miner's private key for each, and delivers the coin
// to the recipient's inbox on the tracker.
//
// Usage:
//   biocrypt-transfer --from ~/.biocrypt/miner-wallet.json \
//                     --to <recipientPublicKeyHash> --all
//   biocrypt-transfer --from ... --to ... --coin <serialHash> [--coin ...]
//   biocrypt-transfer --from ... --to ... --all --tracker wss://host

import { createConnection } from "node:net";
import { connect as tlsConnect } from "node:tls";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import http from "node:http";
import { fileURLToPath } from "node:url";

import {
  sha256,
  computeNullifier,
  derivePublicKeyDNA,
  parseReceiveAddress,
  sealCoinEnvelope,
} from "@biocrypt/core";

function parseArgs(argv) {
  const out = { coins: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from" || a === "-f") out.from = argv[++i];
    else if (a === "--to" || a === "-t") out.to = argv[++i];
    else if (a === "--coin" || a === "-c") out.coins.push(argv[++i]);
    else if (a === "--all" || a === "-a") out.all = true;
    else if (a === "--redeliver" || a === "-r") out.redeliver = true;
    else if (a === "--tracker") out.tracker = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--timeout") out.timeout = Number(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

function usage() {
  console.log(`biocrypt-transfer — transfer miner-owned coins to any wallet

Usage:
  biocrypt-transfer --from <miner-wallet.json> --to <recipientPublicKeyHash> --all
  biocrypt-transfer --from ... --to ... --coin <serialHash> [--coin ...]

Options:
  -f, --from <path>       Miner wallet JSON file (owner of the coins)
  -t, --to <addr>         Recipient's receive address (biocrypt-addr:1:…) for
                          end-to-end encryption, OR a legacy 64-hex public
                          key hash for plaintext directed transfers.
  -c, --coin <serialHash> Transfer a specific coin (repeatable)
  -a, --all               Transfer every unspent coin owned by this wallet
  -r, --redeliver         Include spent coins too (re-sends envelopes for
                          already-spent nullifiers; recipient gets the coin
                          again, no double-spend is recorded)
      --tracker <url>     Tracker WS URL (default: wss://tracker.biocrypt.net)
      --dry-run           Show what would be sent; do not submit
      --timeout <ms>      Fail if no responses within N ms (default: 30000)
  -h, --help              Show this help
`);
}

if (args.help) { usage(); process.exit(0); }
if (!args.from) { console.error("error: --from is required"); usage(); process.exit(2); }
if (!args.to) { console.error("error: --to is required"); usage(); process.exit(2); }
if (!args.all && args.coins.length === 0) {
  console.error("error: pass --all or one/more --coin <serialHash>");
  usage();
  process.exit(2);
}

const TRACKER_WS = args.tracker || process.env.BIOCRYPT_TRACKER || "wss://tracker.biocrypt.net";
const TRACKER_HTTP = TRACKER_WS.replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/$/, "");
const TIMEOUT = Number.isFinite(args.timeout) && args.timeout > 0 ? args.timeout : 30_000;

// ── Load miner wallet ────────────────────────────────────────────────────

function loadMinerWallet(p) {
  const expanded = p.replace(/^~(?=$|\/|\\)/, os.homedir());
  const resolved = path.resolve(expanded);
  if (!fs.existsSync(resolved)) {
    console.error(`error: miner wallet not found at ${resolved}`);
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!raw.privateKeyDNA || !raw.publicKeyDNA) {
    console.error(`error: wallet ${resolved} is missing privateKeyDNA/publicKeyDNA`);
    process.exit(2);
  }
  const derivedPub = derivePublicKeyDNA(raw.privateKeyDNA);
  if (derivedPub !== raw.publicKeyDNA) {
    console.error(`error: wallet ${resolved} public key does not match private key`);
    process.exit(2);
  }
  return raw;
}

const wallet = loadMinerWallet(args.from);
const walletId = wallet.walletId || sha256(wallet.publicKeyDNA).slice(0, 32);

// The recipient value can be either a full receive address
// (`biocrypt-addr:1:…` → 128 DNA base encPubDNA) OR a legacy 64-hex wallet
// public key hash. In the first case we encrypt each envelope with
// `sealCoinEnvelope`; in the second we fall back to the plaintext
// `coin-v1-transfer` envelope for backwards compatibility.
let recipEncPubDNA = null;
let recipToHash = args.to;
try {
  const parsed = parseReceiveAddress(args.to);
  recipEncPubDNA = parsed.encryptPublicKeyDNA;
  recipToHash = parsed.toHash;
} catch {
  /* keep the plaintext fallback */
}

console.log(`biocrypt-transfer`);
console.log(`  from wallet : ${args.from}`);
console.log(`  wallet id   : ${walletId}`);
console.log(`  pubKeyDNA   : ${wallet.publicKeyDNA.slice(0, 24)}...`);
console.log(`  recipient   : ${args.to.length > 60 ? args.to.slice(0, 40) + "\u2026 (receive address)" : args.to}`);
console.log(`  mode        : ${recipEncPubDNA ? "encrypted (end-to-end)" : "plaintext (legacy hash)"}`);
console.log(`  tracker     : ${TRACKER_WS}`);

// ── Fetch coins owned by this miner from the tracker ─────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} on ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

const mintsUrl = args.redeliver
  ? `${TRACKER_HTTP}/mints?owner=${encodeURIComponent(wallet.publicKeyDNA)}`
  : `${TRACKER_HTTP}/mints?owner=${encodeURIComponent(wallet.publicKeyDNA)}&unspent=1`;
const mints = await fetchJson(mintsUrl);
if (!Array.isArray(mints)) {
  console.error(`error: tracker /mints returned unexpected payload`);
  process.exit(3);
}

if (mints.length === 0) {
  console.log(`\nNo unspent coins found for this wallet on the tracker. Nothing to transfer.`);
  process.exit(0);
}

// Pick which coins to transfer.
let selected;
if (args.all) {
  selected = mints;
} else {
  const want = new Set(args.coins);
  selected = mints.filter((m) => want.has(m.coin.serialHash));
  const got = new Set(selected.map((m) => m.coin.serialHash));
  const missing = [...want].filter((s) => !got.has(s));
  if (missing.length) {
    console.error(`error: the following coin serial(s) were not found or already spent:\n  ${missing.join("\n  ")}`);
    process.exit(3);
  }
}

console.log(`  coins       : ${selected.length} to transfer\n`);

if (args.dryRun) {
  for (const m of selected) {
    console.log(`  [dry-run] would transfer ${m.coin.serialHash.slice(0, 12)}...  mintSeq=${m.mintSeq}`);
  }
  process.exit(0);
}

// ── Minimal WebSocket client (same as biocrypt-mine) ─────────────────────

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const makeKey = () => crypto.randomBytes(16).toString("base64");
const expectedAccept = (key) => crypto.createHash("sha1").update(key + WS_GUID).digest("base64");

function encodeTextFrame(str) {
  const payload = Buffer.from(str, "utf8");
  const len = payload.length;
  const mask = crypto.randomBytes(4);
  let header;
  if (len < 126) { header = Buffer.alloc(2); header[1] = 0x80 | len; }
  else if (len < 65536) { header = Buffer.alloc(4); header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
  header[0] = 0x81;
  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, masked]);
}

function parseServerFrames(buf) {
  const frames = [];
  let off = 0;
  while (off < buf.length) {
    if (buf.length - off < 2) break;
    const b0 = buf[off], b1 = buf[off + 1];
    const opcode = b0 & 0x0f;
    let len = b1 & 0x7f;
    let headerLen = 2;
    if (len === 126) { if (buf.length - off < 4) break; len = buf.readUInt16BE(off + 2); headerLen = 4; }
    else if (len === 127) { if (buf.length - off < 10) break; len = Number(buf.readBigUInt64BE(off + 2)); headerLen = 10; }
    const total = headerLen + len;
    if (buf.length - off < total) break;
    frames.push({ opcode, payload: buf.subarray(off + headerLen, off + total) });
    off += total;
  }
  return { frames, rest: buf.subarray(off) };
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const secure = u.protocol === "wss:";
    const host = u.hostname;
    const port = Number(u.port || (secure ? 443 : 80));
    const pathOnly = (u.pathname || "/") + (u.search || "");
    const key = makeKey();
    const accept = expectedAccept(key);
    const handshake =
      `GET ${pathOnly} HTTP/1.1\r\n` +
      `Host: ${host}:${port}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\n` +
      `Sec-WebSocket-Version: 13\r\n` +
      `Origin: https://biocrypt.net\r\n\r\n`;
    const sock = secure
      ? tlsConnect({ host, port, servername: host }, () => sock.write(handshake))
      : createConnection({ host, port }, () => sock.write(handshake));
    let buf = Buffer.alloc(0);
    let handshakeDone = false;
    const client = {
      sock,
      onmessage: () => {},
      onclose: () => {},
      send(obj) { sock.write(encodeTextFrame(JSON.stringify(obj))); },
      close() { try { sock.end(); } catch {} },
    };
    sock.on("error", (err) => reject(err));
    sock.on("close", () => client.onclose());
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshakeDone) {
        const end = buf.indexOf("\r\n\r\n");
        if (end < 0) return;
        const head = buf.subarray(0, end).toString("ascii");
        buf = buf.subarray(end + 4);
        if (!/101/.test(head.split("\r\n")[0])) {
          reject(new Error("ws handshake failed: " + head.split("\r\n")[0]));
          return;
        }
        if (!head.toLowerCase().includes(accept.toLowerCase())) {
          reject(new Error("ws accept mismatch"));
          return;
        }
        handshakeDone = true;
        resolve(client);
      }
      const { frames, rest } = parseServerFrames(buf);
      buf = rest;
      for (const f of frames) {
        if (f.opcode === 0x1) client.onmessage(f.payload.toString("utf8"));
        else if (f.opcode === 0x8) client.close();
        else if (f.opcode === 0x9) {
          const pong = Buffer.concat([
            Buffer.from([0x8a, 0x80 | f.payload.length]),
            crypto.randomBytes(4),
            f.payload,
          ]);
          try { sock.write(pong); } catch {}
        }
      }
    });
  });
}

// ── Send spends + envelopes ──────────────────────────────────────────────

const ws = await connectWs(TRACKER_WS);

ws.send({
  type: "hello",
  role: "transfer",
  label: `biocrypt-transfer@${os.hostname()}`,
  pubKeyHash: walletId,
});

const outstanding = new Map(); // serialHash → { resolve, reject, timer }
let accepted = 0;
let rejected = 0;

ws.onmessage = (text) => {
  let msg;
  try { msg = JSON.parse(text); } catch { return; }
  if (msg.type === "spend-ack" || msg.type === "spend-reject") {
    // Match by nullifier (always present). `coinSerialHash` is also
    // included since tracker 0.3.1; we keep nullifier-indexing for
    // backwards compatibility with older trackers.
    const nullifier = msg.nullifier;
    const entry = nullifier ? outstanding.get(nullifier) : undefined;
    if (!entry) return;
    outstanding.delete(nullifier);
    clearTimeout(entry.timer);
    const serial = msg.coinSerialHash || entry.serial || "(?)";
    if (msg.type === "spend-ack") {
      accepted++;
      console.log(`  ✓ transferred ${serial.slice(0, 12)}...  seq=${msg.spendSeq || "?"}`);
    } else {
      rejected++;
      console.log(`  ✗ rejected    ${serial.slice(0, 12)}...  reason=${msg.reason}`);
    }
    entry.resolve();
  }
};

ws.onclose = () => {
  for (const [nullifier, entry] of outstanding.entries()) {
    clearTimeout(entry.timer);
    console.log(`  · disconnected before ack for ${(entry.serial || nullifier).slice(0, 12)}... (coin may or may not have been accepted)`);
    entry.resolve();
  }
  outstanding.clear();
};

// Index batch parents by serialHash so each child envelope can travel with
// its parent coin (which `verifyCoinV1` requires to validate a child).
// We need the full mint set from the tracker here, not just the unspent
// subset — the parent may already have been transferred/spent before the
// child, which is legal.
const allMints = await fetchJson(`${TRACKER_HTTP}/mints?owner=${encodeURIComponent(wallet.publicKeyDNA)}`);
const parentMap = new Map();
for (const m of allMints) {
  const c = m.coin;
  if (c.batchIndex === 0 || c.batchParent === "" || c.batchParent === undefined) {
    parentMap.set(c.serialHash, c);
  }
}

const pending = selected.map((m) => new Promise((resolve) => {
  const coin = m.coin;
  const serial = coin.serialHash;
  const nullifier = computeNullifier(serial, wallet.privateKeyDNA);
  const isChild = typeof coin.batchIndex === "number" && coin.batchIndex > 0 && coin.batchParent;

  const payload = {
    kind: "coin-v1-transfer",
    coin,
    parent: isChild ? parentMap.get(coin.batchParent) : undefined,
    senderPubKeyDNA: wallet.publicKeyDNA,
    senderWalletId: walletId,
    createdAt: Date.now(),
  };

  let envelope;
  if (recipEncPubDNA) {
    // Encrypted — ciphertext is opaque to the tracker and to every peer
    // on the bus. Only the holder of the matching X25519 private key can
    // decrypt. This mirrors the end-to-end crypto used in chat.biocrypt.net.
    envelope = sealCoinEnvelope(payload, recipEncPubDNA);
  } else {
    envelope = { toPubKeyHash: recipToHash, ...payload };
  }
  const timer = setTimeout(() => {
    if (!outstanding.has(nullifier)) return;
    outstanding.delete(nullifier);
    rejected++;
    console.log(`  ! timeout     ${serial.slice(0, 12)}... (no ack within ${TIMEOUT}ms)`);
    resolve();
  }, TIMEOUT);
  outstanding.set(nullifier, { resolve, reject: resolve, timer, serial });
  ws.send({ type: "spend", nullifier, coinSerialHash: serial, envelope });
}));

await Promise.all(pending);
ws.close();

console.log(`\nDone. accepted=${accepted} rejected=${rejected} (of ${selected.length})`);
process.exit(rejected > 0 ? 1 : 0);
