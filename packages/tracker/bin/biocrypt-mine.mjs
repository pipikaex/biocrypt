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

import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { connect as tlsConnect } from "node:tls";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import https from "node:https";

import {
  generateNetworkKeyPair, derivePublicKeyDNA,
  signCoinWithMiner, verifyCoinV1, verifyBatchV1,
  signBatchChild, rewardForSolve,
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
    else if (a === "--no-sound") out.noSound = true;
    else if (a === "--sound") out.noSound = false;
    else if (a === "--sound-file") out.soundFile = argv[++i];
    else if (a === "--sound-on") out.soundOn = argv[++i]; // "candidate" | "accept" (default)
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
      --no-sound               Disable coin-mined sound effect
      --sound-file <path>      Override sound file (default: ./coin-mined.mp3)
      --sound-on <event>       Play on "candidate" (fast) or "accept" (default)
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
    path.join(here, "zcoin-miner-v1"),
    path.join(here, "..", "..", "..", "zcoin-miner-v1"),
    path.join(process.cwd(), "zcoin-miner-v1"),
    path.join(os.homedir(), ".biocrypt", "zcoin-miner-v1"),
    path.join(os.homedir(), ".local", "bin", "zcoin-miner-v1"),
    "/opt/homebrew/bin/zcoin-miner-v1",
    "/usr/local/bin/zcoin-miner-v1",
    "/usr/bin/zcoin-miner-v1",
  ];
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch { /* */ }
  }
  // Nothing pre-built found: try to auto-compile from the shipped C source.
  const built = tryAutoCompile(here);
  if (built) return built;
  return "zcoin-miner-v1";
}

function tryAutoCompile(here) {
  const sourceCandidates = [
    path.join(here, "zcoin-miner-v1.c"),
    path.join(here, "..", "..", "..", "zcoin-miner-v1.c"),
    path.join(process.cwd(), "zcoin-miner-v1.c"),
  ];
  const source = sourceCandidates.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  if (!source) return null;
  const compilers = ["clang", "cc", "gcc"];
  const compiler = compilers.find((c) => spawnSync("which", [c], { stdio: "ignore" }).status === 0);
  if (!compiler) {
    console.error("[miner] no C compiler found (clang/cc/gcc). Install Xcode CLT (macOS) or build-essential (Linux), then re-run biocrypt-mine.");
    return null;
  }
  const destDir = path.join(os.homedir(), ".biocrypt");
  try { fs.mkdirSync(destDir, { recursive: true }); } catch { /* */ }
  const dest = path.join(destDir, "zcoin-miner-v1");
  console.log(`[miner] no prebuilt zcoin-miner-v1 on PATH — compiling from ${source}`);
  // `-pthread` is required on Linux for pthread_mutex_* / pthread_cond_*;
  // harmless on macOS where pthreads ship in libSystem.
  const cflags = ["-O3", "-pthread", "-o", dest, source];
  let res = spawnSync(compiler, cflags, { stdio: "inherit" });
  if (res.status !== 0) {
    // Some very old compilers don't understand `-pthread`; retry without it.
    console.error(`[miner] ${compiler} with -pthread failed (exit ${res.status}); retrying without it`);
    res = spawnSync(compiler, ["-O3", "-o", dest, source, "-lpthread"], { stdio: "inherit" });
  }
  if (res.status !== 0) {
    console.error(`[miner] ${compiler} failed to build zcoin-miner-v1 (exit ${res.status})`);
    return null;
  }
  try { fs.chmodSync(dest, 0o755); } catch { /* */ }
  console.log(`[miner] built zcoin-miner-v1 -> ${dest}`);
  return dest;
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

// ── Sound effect ─────────────────────────────────────────────────────────
//
// Plays a short chime when a coin is mined. Cross-platform best-effort: uses
// afplay on macOS, paplay/aplay/mpg123/ffplay on Linux, PowerShell on Windows.
// Disabled with --no-sound. Sound file resolved from:
//   1. --sound-file <path>
//   2. ./coin-mined.mp3 next to this script
//   3. ./coin-mined.mp3 in the current working directory
//   4. auto-download https://biocrypt.net/sfx/coin-mined.mp3 once to ~/.biocrypt/

const SFX_ON = !args.noSound;
const SFX_EVENT = (args.soundOn === "candidate") ? "candidate" : "accept";

function resolveSoundFile() {
  if (args.soundFile) {
    return fs.existsSync(args.soundFile) ? args.soundFile : null;
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "coin-mined.mp3"),
    path.join(process.cwd(), "coin-mined.mp3"),
    path.join(os.homedir(), ".biocrypt", "coin-mined.mp3"),
  ];
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch { /* */ }
  }
  return null;
}

function downloadSoundFile(cb) {
  const dest = path.join(os.homedir(), ".biocrypt", "coin-mined.mp3");
  try { fs.mkdirSync(path.dirname(dest), { recursive: true }); } catch {}
  const url = "https://biocrypt.net/sfx/coin-mined.mp3";
  const file = fs.createWriteStream(dest);
  https.get(url, (res) => {
    if (res.statusCode !== 200) {
      try { fs.unlinkSync(dest); } catch {}
      return cb(null);
    }
    res.pipe(file);
    file.on("finish", () => file.close(() => cb(dest)));
  }).on("error", () => {
    try { fs.unlinkSync(dest); } catch {}
    cb(null);
  });
}

let soundFilePath = SFX_ON ? resolveSoundFile() : null;
if (SFX_ON && !soundFilePath) {
  downloadSoundFile((p) => {
    if (p) {
      soundFilePath = p;
      console.log(`  [sfx] downloaded sound to ${p}`);
    } else {
      console.log(`  [sfx] no sound file found and download failed; continuing silently`);
    }
  });
}

function playSoundCommand() {
  if (!soundFilePath) return null;
  if (process.platform === "darwin") return ["afplay", [soundFilePath]];
  if (process.platform === "linux") {
    for (const bin of ["paplay", "mpg123", "ffplay", "aplay"]) {
      const extra = bin === "ffplay" ? ["-autoexit", "-nodisp", "-loglevel", "quiet", soundFilePath]
                   : bin === "mpg123" ? ["-q", soundFilePath]
                   : [soundFilePath];
      return [bin, extra];
    }
  }
  if (process.platform === "win32") {
    return ["powershell", ["-NoProfile", "-Command",
      `Add-Type -AssemblyName PresentationCore; ` +
      `$p = New-Object System.Windows.Media.MediaPlayer; ` +
      `$p.Open([uri]'${soundFilePath.replace(/\\/g, "/")}'); ` +
      `$p.Play(); Start-Sleep -Seconds 3`,
    ]];
  }
  return null;
}

function playCoinSound() {
  if (!SFX_ON || !soundFilePath) return;
  const cmd = playSoundCommand();
  if (!cmd) return;
  try {
    const child = spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true });
    child.unref();
    child.on("error", () => { /* player binary missing — stay quiet */ });
  } catch { /* noop */ }
}

// ── Main ────────────────────────────────────────────────────────────────

const wallet = loadOrCreateWallet();
const minerPubKeyDNA = wallet.publicKeyDNA || derivePublicKeyDNA(wallet.privateKeyDNA);

console.log(`\n  BioCrypt v1 miner`);
console.log(`  tracker : ${TRACKER_URL}`);
console.log(`  wallet  : ${WALLET_PATH}`);
console.log(`  id      : ${wallet.walletId}`);
console.log(`  binary  : ${MINER_BIN}`);
console.log(`  sound   : ${SFX_ON ? `on (${SFX_EVENT})` : "off"}${soundFilePath ? "  " + soundFilePath : ""}\n`);

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
  child.on("error", (err) => {
    if (err && err.code === "ENOENT") {
      console.error(`\n[miner] could not launch zcoin-miner-v1 at "${MINER_BIN}".`);
      console.error("[miner] Build it once with:");
      console.error("        cc    -O3 -pthread -o zcoin-miner-v1 zcoin-miner-v1.c   # Linux / BSD");
      console.error("        clang -O3          -o zcoin-miner-v1 zcoin-miner-v1.c   # macOS");
      console.error("        sudo mv zcoin-miner-v1 /usr/local/bin/   # or /opt/homebrew/bin on Apple Silicon");
      console.error("[miner] Or pass a custom path with --miner /path/to/zcoin-miner-v1");
      process.exit(127);
    }
    console.error(`[miner] spawn error: ${err?.message || err}`);
    process.exit(1);
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

// Track the tracker's current solve count so we can size each batch correctly.
// Initialized from the `welcome` summary and incremented per accepted batch.
let currentSolveCount = 0;

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
  const parentBase = signCoinWithMiner(mining, wallet.privateKeyDNA, genomeFingerprint);
  parentBase.miningProof.leadingTs = cand.leadingTs;

  const batchSize = rewardForSolve(currentSolveCount);
  const parent = {
    ...parentBase,
    batchParent: "",
    batchIndex: 0,
    batchSize,
  };

  const children = [];
  for (let i = 1; i < batchSize; i++) {
    children.push(signBatchChild({
      parent,
      batchIndex: i,
      batchSize,
      minerPrivateKeyDNA: wallet.privateKeyDNA,
      networkGenomeFingerprint: genomeFingerprint,
    }));
  }

  const verify = verifyBatchV1(parent, children, { expectedGenomeFingerprint: genomeFingerprint });
  if (!verify.ok) {
    console.error(`  [miner] self-check FAILED: ${verify.reason}`);
    return;
  }

  if (LOG_PATH) {
    try {
      for (const coin of [parent, ...children]) {
        fs.appendFileSync(LOG_PATH, JSON.stringify(coin) + "\n");
      }
    } catch {}
  }

  if (SFX_EVENT === "candidate") playCoinSound();

  if (args.localOnly) {
    console.log(`  ✓ signed batch  size=${batchSize}  parent=${serialHash.slice(0, 12)}  lts=${cand.leadingTs}  (local-only)`);
    if (SFX_EVENT === "accept") playCoinSound();
    return;
  }

  if (!ws.ready) {
    console.log(`  · buffered (tracker offline)  batch size=${batchSize}  parent=${serialHash.slice(0, 12)}`);
    pending.push({ parent, children });
    return;
  }
  ws.send({ type: "mint-batch", parent, children });
  console.log(`  → submitted batch  seq=${cand.seq}  size=${batchSize}  parent=${serialHash.slice(0, 12)}  lts=${cand.leadingTs}`);
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
        if (msg.summary && typeof msg.summary.totalSolves === "number") {
          currentSolveCount = msg.summary.totalSolves;
        }
        console.log(`  [ws] welcome tracker=${msg.trackerId} genome=${(msg.genomeFingerprint || "").slice(0, 12)}... lts=${msg.leadingTs} solves=${currentSolveCount} reward=${rewardForSolve(currentSolveCount)}`);
        while (pending.length) {
          const { parent, children } = pending.shift();
          ws.send({ type: "mint-batch", parent, children });
        }
        break;
      }
      case "summary": {
        if (msg.summary && typeof msg.summary.totalSolves === "number") {
          currentSolveCount = msg.summary.totalSolves;
        }
        break;
      }
      case "mint-batch-ack": {
        const size = Number(msg.size || 1);
        coinsSubmitted += size;
        currentSolveCount++;
        const nextReward = rewardForSolve(currentSolveCount);
        console.log(`  ★ batch accepted  size=${size}  solve=${msg.solveSeq}  parent=${(msg.parentSerialHash || "").slice(0, 12)}  (total coins ${coinsSubmitted}, next reward=${nextReward})`);
        if (SFX_EVENT === "accept") playCoinSound();
        break;
      }
      case "mint-batch-reject": {
        coinsRejected++;
        console.log(`  ✗ batch rejected  parent=${(msg.parentSerialHash || "").slice(0, 12)}  reason=${msg.reason}`);
        // Sync our solve count from the tracker in case halving boundary caused a size mismatch.
        ws.send({ type: "summary" });
        break;
      }
      case "mint-ack":
        coinsSubmitted++;
        console.log(`  ★ accepted  serial=${(msg.serialHash || "").slice(0, 12)}  mintSeq=${msg.mintSeq}  (total ${coinsSubmitted})`);
        if (SFX_EVENT === "accept") playCoinSound();
        break;
      case "mint-reject":
        coinsRejected++;
        console.log(`  ✗ rejected  serial=${(msg.serialHash || "").slice(0, 12)}  reason=${msg.reason}`);
        break;
      case "broadcast-mint":
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
