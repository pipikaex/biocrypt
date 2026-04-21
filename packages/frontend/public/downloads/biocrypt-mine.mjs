#!/usr/bin/env node
// biocrypt-mine — decentralized miner client for BioCrypt v1.
//
// Spawns the native PoW binary (zcoin-miner-v1) and signs each candidate with
// the miner's wallet before submitting over WebSocket to a tracker.
//
// Usage:
//   biocrypt-mine                               (defaults: wss://tracker.biocrypt.net)
//   biocrypt-mine --tracker wss://host:6690
//   biocrypt-mine --tracker wss://... --miner ./zcoin-miner-v1 --threads 8
//   biocrypt-mine --wallet ~/.biocrypt/miner-wallet.json
//   biocrypt-mine --local-only                  (sign candidates, log but do not submit)

import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { connect as tlsConnect } from "node:tls";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import {
  generateNetworkKeyPair, derivePublicKeyDNA,
  signCoinWithMiner, verifyCoinV1,
  ribosome, sha256,
  GENESIS_GENOME_FINGERPRINT, GENESIS_LEADING_TS,
} from "@biocrypt/core";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tracker" || a === "-t") out.tracker = argv[++i];
    else if (a === "--miner" || a === "-m") out.miner = argv[++i];
    else if (a === "--threads" || a === "-j") out.threads = Number(argv[++i]);
    else if (a === "--leading-ts") out.leadingTs = Number(argv[++i]);
    else if (a === "--wallet" || a === "-w") out.wallet = argv[++i];
    else if (a === "--label" || a === "-l") out.label = argv[++i];
    else if (a === "--local-only") out.localOnly = true;
    else if (a === "--log" || a === "-L") out.log = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`biocrypt-mine — BioCrypt v1 decentralized miner

Usage: biocrypt-mine [options]

Options:
  -t, --tracker <ws-url>       Tracker to submit to (default: wss://tracker.biocrypt.net)
  -m, --miner <path>           Path to zcoin-miner-v1 binary (default: find on PATH)
  -j, --threads <n>            Mining threads (default: ncpu - 1)
      --leading-ts <n>         Override PoW difficulty (default: tracker's value)
  -w, --wallet <path>          Miner wallet file (default: ~/.biocrypt/miner-wallet.json)
  -l, --label <label>          Human-readable miner label
      --local-only             Sign candidates but don't submit (offline test)
  -L, --log <path>             Append signed coins to this JSONL file
  -h, --help                   Show this help
`);
  process.exit(0);
}

const WALLET_DEFAULT = path.join(os.homedir(), ".biocrypt", "miner-wallet.json");
const WALLET_PATH = args.wallet || WALLET_DEFAULT;
const TRACKER_URL = args.tracker || process.env.BIOCRYPT_TRACKER || "wss://tracker.biocrypt.net";
const MINER_BIN = args.miner || findMinerBin();
const LABEL = args.label || `miner@${os.hostname()}`;
const LOG_PATH = args.log || null;

function findMinerBin() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "..", "..", "zcoin-miner-v1"),
    path.join(process.cwd(), "zcoin-miner-v1"),
    "/usr/local/bin/zcoin-miner-v1",
  ];
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch { /* */ }
  }
  return "zcoin-miner-v1";
}

function loadOrCreateWallet() {
  if (fs.existsSync(WALLET_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
      if (!raw.privateKeyDNA || !raw.publicKeyDNA) throw new Error("invalid wallet");
      return raw;
    } catch (e) {
      console.error(`[miner] wallet at ${WALLET_PATH} is corrupted: ${e.message}`);
      process.exit(2);
    }
  }
  const kp = generateNetworkKeyPair();
  const wallet = {
    version: 1,
    createdAt: new Date().toISOString(),
    label: LABEL,
    publicKeyDNA: kp.publicKeyDNA,
    privateKeyDNA: kp.privateKeyDNA,
    walletId: sha256(kp.publicKeyDNA).slice(0, 32),
  };
  fs.mkdirSync(path.dirname(WALLET_PATH), { recursive: true });
  fs.writeFileSync(WALLET_PATH, JSON.stringify(wallet, null, 2), { mode: 0o600 });
  console.log(`[miner] created new wallet at ${WALLET_PATH}`);
  console.log(`[miner] wallet id: ${wallet.walletId}`);
  console.log(`[miner] KEEP YOUR PRIVATE KEY SAFE. If you lose this file, you lose mined coins.`);
  return wallet;
}

// ── Minimal WebSocket client (RFC 6455) ──────────────────────────────────

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function makeKey() {
  return crypto.randomBytes(16).toString("base64");
}

function expectedAccept(key) {
  return crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
}

function encodeTextFrame(str) {
  const payload = Buffer.from(str, "utf8");
  const len = payload.length;
  const mask = crypto.randomBytes(4);
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
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
    if (len === 126) {
      if (buf.length - off < 4) break;
      len = buf.readUInt16BE(off + 2);
      headerLen = 4;
    } else if (len === 127) {
      if (buf.length - off < 10) break;
      len = Number(buf.readBigUInt64BE(off + 2));
      headerLen = 10;
    }
    const total = headerLen + len;
    if (buf.length - off < total) break;
    const payload = buf.subarray(off + headerLen, off + total);
    frames.push({ opcode, payload });
    off += total;
  }
  return { frames, rest: buf.subarray(off) };
}

class WsClient {
  constructor(url) {
    this.url = url;
    const u = new URL(url);
    this.isSecure = u.protocol === "wss:";
    this.host = u.hostname;
    this.port = Number(u.port || (this.isSecure ? 443 : 80));
    this.path = (u.pathname || "/") + (u.search || "");
    this.buf = Buffer.alloc(0);
    this.handlers = { open: [], message: [], close: [], error: [] };
    this.ready = false;
    this.closed = false;
  }
  on(evt, fn) { this.handlers[evt].push(fn); return this; }
  emit(evt, ...args) { for (const fn of this.handlers[evt] || []) { try { fn(...args); } catch {} } }
  connect() {
    const key = makeKey();
    const accept = expectedAccept(key);
    const headers =
      `GET ${this.path} HTTP/1.1\r\n` +
      `Host: ${this.host}:${this.port}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\n` +
      `Sec-WebSocket-Version: 13\r\n` +
      `Origin: https://biocrypt.net\r\n\r\n`;
    const onConnect = () => {
      this.sock.write(headers);
    };
    this.sock = this.isSecure
      ? tlsConnect({ host: this.host, port: this.port, servername: this.host }, onConnect)
      : createConnection({ host: this.host, port: this.port }, onConnect);
    this.sock.on("error", (err) => { this.emit("error", err); this.sock.destroy(); });
    this.sock.on("close", () => { if (!this.closed) { this.closed = true; this.emit("close"); } });
    let handshakeDone = false;
    this.sock.on("data", (chunk) => {
      this.buf = Buffer.concat([this.buf, chunk]);
      if (!handshakeDone) {
        const end = this.buf.indexOf("\r\n\r\n");
        if (end < 0) return;
        const head = this.buf.subarray(0, end).toString("ascii");
        this.buf = this.buf.subarray(end + 4);
        if (!/101/.test(head.split("\r\n")[0])) {
          this.emit("error", new Error("ws handshake failed: " + head.split("\r\n")[0]));
          this.sock.destroy();
          return;
        }
        if (!head.toLowerCase().includes(accept.toLowerCase())) {
          this.emit("error", new Error("ws accept mismatch"));
          this.sock.destroy();
          return;
        }
        handshakeDone = true;
        this.ready = true;
        this.emit("open");
      }
      const { frames, rest } = parseServerFrames(this.buf);
      this.buf = rest;
      for (const f of frames) {
        if (f.opcode === 0x1) this.emit("message", f.payload.toString("utf8"));
        else if (f.opcode === 0x8) { this.closed = true; this.emit("close"); this.sock.end(); }
        else if (f.opcode === 0x9) {
          const pong = Buffer.concat([Buffer.from([0x8a, 0x80 | f.payload.length]), crypto.randomBytes(4), f.payload]);
          try { this.sock.write(pong); } catch {}
        }
      }
    });
  }
  send(obj) {
    if (!this.ready) return false;
    try { this.sock.write(encodeTextFrame(JSON.stringify(obj))); return true; }
    catch (e) { this.emit("error", e); return false; }
  }
  close() { try { this.sock.end(); } catch {} this.closed = true; }
}

// ── Main ────────────────────────────────────────────────────────────────

const wallet = loadOrCreateWallet();
const minerPubKeyDNA = wallet.publicKeyDNA || derivePublicKeyDNA(wallet.privateKeyDNA);

console.log(`\n  BioCrypt v1 miner`);
console.log(`  tracker : ${TRACKER_URL}`);
console.log(`  wallet  : ${WALLET_PATH}`);
console.log(`  id      : ${wallet.walletId}`);
console.log(`  binary  : ${MINER_BIN}\n`);

let currentLeadingTs = args.leadingTs ?? GENESIS_LEADING_TS;
let genomeFingerprint = GENESIS_GENOME_FINGERPRINT;
let coinsSubmitted = 0;
let coinsRejected = 0;
let lastStat = null;

const ws = args.localOnly ? null : new WsClient(TRACKER_URL);

function startMiner() {
  const argsV = ["--leading-ts", String(currentLeadingTs)];
  if (args.threads) argsV.push("--threads", String(args.threads));
  const child = spawn(MINER_BIN, argsV, {
    stdio: ["pipe", "pipe", "inherit"],
  });
  child.on("exit", (code) => {
    console.log(`\n  [miner] exited (code ${code})`);
    process.exit(code ?? 0);
  });
  const rl = readline.createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.type === "candidate") handleCandidate(msg, child);
    else if (msg.type === "stat") lastStat = msg;
  });
  return child;
}

function handleCandidate(cand, child) {
  const rib = ribosome(cand.gene);
  const protein = rib.proteins[0];
  if (!protein) return;
  const serial = protein.aminoAcids.slice(4).join("-");
  const serialHash = sha256(serial);
  const mining = {
    coinGene: cand.gene,
    protein,
    serial,
    serialHash,
    nonce: cand.nonce,
    hash: "",
    difficulty: "T".repeat(cand.leadingTs),
    minedAt: Date.now(),
  };
  const coin = signCoinWithMiner(mining, wallet.privateKeyDNA, genomeFingerprint);
  coin.miningProof.leadingTs = cand.leadingTs;

  // Re-sign so the embedded leadingTs is covered (message doesn't include leadingTs, so no re-sign needed)
  const verify = verifyCoinV1(coin, { expectedGenomeFingerprint: genomeFingerprint });
  if (!verify.ok) {
    console.error(`  [miner] self-check FAILED: ${verify.reason}`);
    return;
  }

  if (LOG_PATH) {
    try { fs.appendFileSync(LOG_PATH, JSON.stringify(coin) + "\n"); } catch {}
  }

  if (args.localOnly) {
    console.log(`  ✓ signed  seq=${cand.seq}  serial=${serialHash.slice(0, 12)}  lts=${cand.leadingTs}  (local-only)`);
    return;
  }

  if (!ws.ready) {
    console.log(`  · buffered (tracker offline)  serial=${serialHash.slice(0, 12)}`);
    pending.push(coin);
    return;
  }
  ws.send({ type: "mint", coin });
  console.log(`  → submitted  seq=${cand.seq}  serial=${serialHash.slice(0, 12)}  lts=${cand.leadingTs}`);
}

const pending = [];

if (ws) {
  ws.on("open", () => {
    console.log(`  [ws] connected to ${TRACKER_URL}`);
    ws.send({
      type: "hello",
      role: "miner",
      label: LABEL,
      pubKeyHash: wallet.walletId,
    });
  });
  ws.on("message", (text) => {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    switch (msg.type) {
      case "welcome": {
        genomeFingerprint = msg.genomeFingerprint || genomeFingerprint;
        if (msg.leadingTs && !args.leadingTs) {
          const newLts = Math.max(currentLeadingTs, Number(msg.leadingTs));
          if (newLts !== currentLeadingTs) {
            currentLeadingTs = newLts;
            if (minerChild?.stdin) {
              minerChild.stdin.write(JSON.stringify({ type: "set-leading-ts", value: newLts }) + "\n");
            }
          }
        }
        console.log(`  [ws] welcome tracker=${msg.trackerId} genome=${(msg.genomeFingerprint || "").slice(0, 12)}... lts=${msg.leadingTs}`);
        while (pending.length) ws.send({ type: "mint", coin: pending.shift() });
        break;
      }
      case "mint-ack":
        coinsSubmitted++;
        console.log(`  ★ accepted  serial=${(msg.serialHash || "").slice(0, 12)}  mintSeq=${msg.mintSeq}  (total ${coinsSubmitted})`);
        break;
      case "mint-reject":
        coinsRejected++;
        console.log(`  ✗ rejected  serial=${(msg.serialHash || "").slice(0, 12)}  reason=${msg.reason}`);
        break;
      case "broadcast-mint":
        // Live feed, ignore for miner role
        break;
      default: break;
    }
  });
  ws.on("close", () => {
    console.log(`  [ws] disconnected — reconnecting in 3s`);
    setTimeout(() => { ws.connect(); }, 3000);
  });
  ws.on("error", (err) => {
    console.error(`  [ws] error: ${err.message}`);
  });
  ws.connect();
}

const minerChild = startMiner();

setInterval(() => {
  if (lastStat) {
    const rate = lastStat.rate >= 1e6 ? `${(lastStat.rate/1e6).toFixed(2)} MH/s`
                : lastStat.rate >= 1e3 ? `${(lastStat.rate/1e3).toFixed(1)} kH/s`
                : `${lastStat.rate} H/s`;
    console.log(`  [stat]  ${rate}  |  ${lastStat.hashes} hashes  |  ${coinsSubmitted} accepted / ${coinsRejected} rejected  |  uptime ${lastStat.uptime}s`);
  }
}, 15000);

function shutdown() {
  console.log("\n  shutting down...");
  try { minerChild.stdin.write(JSON.stringify({ type: "quit" }) + "\n"); } catch {}
  try { minerChild.kill("SIGTERM"); } catch {}
  if (ws) ws.close();
  setTimeout(() => process.exit(0), 1500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
