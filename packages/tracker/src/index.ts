/**
 * @biocrypt/tracker — zero-dep WebSocket tracker for BioCrypt v1.
 *
 * Any miner, wallet, or peer tracker can connect via ws:// or wss:// and
 * exchange mints, spends, and encrypted envelopes. The tracker verifies
 * every mint and spend locally against the v1 protocol rules; see
 * PROTOCOL.md in the kronixcoin repo.
 */

import http from "node:http";
import https from "node:https";
import type { Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { Buffer } from "node:buffer";
import {
  encodeTextFrame, encodeCloseFrame, encodePong,
  parseFrames, wsAccept,
} from "./ws-frame.js";
import { TrackerState, type TrackedMint, type TrackedSpend } from "./state.js";
import {
  verifyCoinV1,
  verifyBatchV1,
  isBatchChild,
  GENESIS_GENOME_FINGERPRINT,
  GENESIS_LEADING_TS,
  sha256,
  type CoinV1,
} from "@biocrypt/core";

export interface TrackerOptions {
  port?: number;
  host?: string;
  persistPath?: string;
  peers?: string[];
  log?: (...args: unknown[]) => void;
  leadingTs?: number;
  genomeFingerprint?: string;
}

export interface TrackerHandle {
  readonly port: number;
  readonly host: string;
  readonly url: string;
  readonly trackerId: string;
  state: TrackerState;
  close(): Promise<void>;
}

interface ClientRecord {
  id: number;
  socket: Socket;
  role: string;
  label: string;
  pubKeyHash: string;
  buf: Buffer;
  alive: boolean;
  isPeer: boolean;
  peerUrl?: string;
}

export async function startTracker(opts: TrackerOptions = {}): Promise<TrackerHandle> {
  const port = opts.port ?? Number(process.env.PORT || 6690);
  const host = opts.host ?? "0.0.0.0";
  const persistPath = opts.persistPath ?? process.env.TRACKER_DATA
    ?? "./tracker-data/tracker.json";
  const log = opts.log ?? ((...a: unknown[]) => console.log(...(a as [unknown])));
  const leadingTs = opts.leadingTs ?? GENESIS_LEADING_TS;
  const genomeFingerprint = opts.genomeFingerprint ?? GENESIS_GENOME_FINGERPRINT;

  const state = new TrackerState(persistPath);
  state.rehydrateSolveCursor();

  let nextId = 1;
  const clients = new Map<number, ClientRecord>();

  function clientStats() {
    let miners = 0;
    let webClients = 0;
    let peerTrackers = 0;
    let other = 0;
    for (const c of clients.values()) {
      if (!c.alive) continue;
      if (c.isPeer) peerTrackers++;
      else if (c.role === "miner" || c.role === "browser-miner") miners++;
      else if (c.role === "biocrypt-web" || c.role === "tracker-viewer" || c.role === "wallet") webClients++;
      else other++;
    }
    return { miners, webClients, peerTrackers, other, totalConnected: miners + webClients + peerTrackers + other };
  }

  function summaryWithClients() {
    return { ...state.summary(), ...clientStats(), peers: clients.size };
  }

  function sendTo(id: number, obj: unknown): void {
    const c = clients.get(id);
    if (!c || !c.alive) return;
    try { c.socket.write(encodeTextFrame(JSON.stringify(obj))); } catch { /* */ }
  }

  function broadcast(obj: unknown, exceptId = -1): void {
    const frame = encodeTextFrame(JSON.stringify(obj));
    for (const c of clients.values()) {
      if (c.id === exceptId || !c.alive) continue;
      try { c.socket.write(frame); } catch { /* */ }
    }
  }

  function recordMint(coin: CoinV1, source: string): TrackedMint | null {
    // Legacy single-coin path: reject batch children here — they must come in
    // via `mint-batch` bundled with their parent.
    if (isBatchChild(coin)) return null;
    const result = verifyCoinV1(coin, { expectedGenomeFingerprint: genomeFingerprint });
    if (!result.ok) return null;
    const rec = state.addMint(coin);
    if (!rec) return null;
    log(`[tracker] mint+ seq=${rec.mintSeq} serial=${coin.serialHash.slice(0, 12)} src=${source}`);
    broadcast({ type: "broadcast-mint", coin, mintSeq: rec.mintSeq });
    return rec;
  }

  function recordBatch(parent: CoinV1, children: CoinV1[], source: string): TrackedMint[] | null {
    const vr = verifyBatchV1(parent, children, { expectedGenomeFingerprint: genomeFingerprint });
    if (!vr.ok) return null;
    const recs = state.addBatch(parent, children);
    if (!recs) return null;
    const solveSeq = recs[0].solveSeq;
    log(`[tracker] batch+ solve=${solveSeq} size=${recs.length} parent=${parent.serialHash.slice(0, 12)} src=${source}`);
    // Broadcast each coin individually so existing subscribers keep working.
    for (const rec of recs) {
      broadcast({ type: "broadcast-mint", coin: rec.coin, mintSeq: rec.mintSeq });
    }
    return recs;
  }

  function recordSpend(
    nullifier: string,
    coinSerialHash: string,
    origin: "local" | "peer",
  ): TrackedSpend | null {
    const rec = state.addSpend(nullifier, coinSerialHash, origin);
    if (!rec) return null;
    log(`[tracker] spend+ seq=${rec.spendSeq} nullifier=${nullifier.slice(0, 12)} origin=${origin}`);
    broadcast({ type: "broadcast-spend", nullifier, coinSerialHash, spendSeq: rec.spendSeq });
    return rec;
  }

  function handleClientMessage(id: number, text: string): void {
    let msg: any;
    try { msg = JSON.parse(text); } catch { return; }
    const me = clients.get(id);
    if (!me) return;

    switch (msg.type) {
      case "hello": {
        me.role = String(msg.role || "client").slice(0, 32);
        me.label = String(msg.label || me.role + " " + id).slice(0, 128);
        me.pubKeyHash = String(msg.pubKeyHash || "").slice(0, 128);
        sendTo(id, {
          type: "welcome",
          clientId: id,
          trackerId: state.trackerId,
          genomeFingerprint,
          leadingTs,
          summary: summaryWithClients(),
        });
        break;
      }
      case "mint": {
        if (!msg.coin) {
          sendTo(id, { type: "mint-reject", reason: "missing coin" });
          return;
        }
        const coin = msg.coin as CoinV1;
        if (isBatchChild(coin)) {
          sendTo(id, {
            type: "mint-reject",
            serialHash: coin.serialHash,
            reason: "batch child must be submitted via mint-batch with parent",
          });
          return;
        }
        const existing = state.hasMint(coin.serialHash);
        if (existing) {
          sendTo(id, {
            type: "mint-reject",
            serialHash: coin.serialHash,
            reason: "already known",
          });
          return;
        }
        const vr = verifyCoinV1(coin, { expectedGenomeFingerprint: genomeFingerprint });
        if (!vr.ok) {
          sendTo(id, {
            type: "mint-reject",
            serialHash: coin.serialHash,
            reason: vr.reason,
          });
          return;
        }
        const rec = recordMint(coin, me.role);
        if (rec) {
          sendTo(id, {
            type: "mint-ack",
            serialHash: coin.serialHash,
            mintSeq: rec.mintSeq,
          });
        }
        break;
      }
      case "mint-batch": {
        const parent = msg.parent as CoinV1 | undefined;
        const children = (msg.children || []) as CoinV1[];
        if (!parent || !Array.isArray(children)) {
          sendTo(id, { type: "mint-batch-reject", reason: "missing parent or children" });
          return;
        }
        if (state.hasMint(parent.serialHash)) {
          sendTo(id, {
            type: "mint-batch-reject",
            parentSerialHash: parent.serialHash,
            reason: "parent already known",
          });
          return;
        }
        const vr = verifyBatchV1(parent, children, { expectedGenomeFingerprint: genomeFingerprint });
        if (!vr.ok) {
          sendTo(id, {
            type: "mint-batch-reject",
            parentSerialHash: parent.serialHash,
            reason: vr.reason,
            failedIndex: (vr as any).failedIndex,
          });
          return;
        }
        const recs = recordBatch(parent, children, me.role);
        if (recs) {
          sendTo(id, {
            type: "mint-batch-ack",
            parentSerialHash: parent.serialHash,
            solveSeq: recs[0].solveSeq,
            size: recs.length,
            mintSeqs: recs.map((r) => r.mintSeq),
          });
        } else {
          sendTo(id, {
            type: "mint-batch-reject",
            parentSerialHash: parent.serialHash,
            reason: "duplicate serialHash within batch",
          });
        }
        break;
      }
      case "spend": {
        const { nullifier, coinSerialHash, envelope } = msg || {};
        if (typeof nullifier !== "string"
            || typeof coinSerialHash !== "string"
            || nullifier.length < 8) {
          sendTo(id, { type: "spend-reject", reason: "bad payload" });
          return;
        }
        if (state.hasSpend(nullifier)) {
          // Already-spent nullifier but a well-formed envelope: treat as a
          // re-delivery request. The coin itself can't be double-spent
          // (nullifier is pinned), but the envelope must reach the
          // recipient's inbox. Useful when a previous envelope was
          // consumed by a stale client and never actually applied.
          if (envelope && typeof envelope === "object") {
            const toHash = String((envelope as any).toPubKeyHash || "").slice(0, 128);
            if (toHash && state.hasMint(coinSerialHash)) {
              const env = state.addEnvelope({
                envelope,
                toPubKeyHash: toHash,
                coinSerialHash,
                nullifier,
              });
              // Gossip metadata only — never leak envelope bodies to every
              // connected peer. Recipients pull the body from their inbox.
              broadcast({
                type: "envelope-meta",
                envelopeSeq: env.envelopeSeq,
                toPubKeyHash: toHash,
                coinSerialHash,
                nullifier,
              });
              sendTo(id, { type: "spend-ack", nullifier, coinSerialHash, spendSeq: 0, redelivery: true });
              return;
            }
          }
          sendTo(id, { type: "spend-reject", nullifier, coinSerialHash, reason: "already spent" });
          return;
        }
        const mint = state.hasMint(coinSerialHash);
        if (!mint) {
          sendTo(id, {
            type: "spend-reject",
            nullifier,
            coinSerialHash,
            reason: "unknown coin",
          });
          return;
        }
        const rec = recordSpend(nullifier, coinSerialHash, "local");
        if (rec && envelope && typeof envelope === "object") {
          const toHash = String((envelope as any).toPubKeyHash || "").slice(0, 128);
          if (toHash) {
            const env = state.addEnvelope({
              envelope,
              toPubKeyHash: toHash,
              coinSerialHash,
              nullifier,
            });
            // Gossip metadata only — envelope bodies stay in the addressed
            // inbox. Prevents drive-by claim attacks against plaintext v1.1
            // envelopes and reduces bandwidth for large payloads.
            broadcast({
              type: "envelope-meta",
              envelopeSeq: env.envelopeSeq,
              toPubKeyHash: toHash,
              coinSerialHash,
              nullifier,
            });
          }
        }
        if (rec) {
          sendTo(id, { type: "spend-ack", nullifier, coinSerialHash, spendSeq: rec.spendSeq });
        }
        break;
      }
      case "fetch-inbox": {
        const pubKeyHash = String(msg.pubKeyHash || "");
        if (!pubKeyHash) return;
        const envs = state.inboxFor(pubKeyHash);
        sendTo(id, { type: "inbox", pubKeyHash, envelopes: envs });
        if (msg.consume) state.consumeInbox(pubKeyHash);
        break;
      }
      case "sync-request": {
        const sinceMint = Number(msg.sinceMintSeq || 0);
        const sinceSpend = Number(msg.sinceSpendSeq || 0);
        const mints = state.mintsSince(sinceMint).slice(0, 1000);
        const spends = state.spendsSince(sinceSpend).slice(0, 1000);
        sendTo(id, {
          type: "sync-delta",
          mints,
          spends,
          cursors: state.cursors(),
        });
        break;
      }
      case "summary": {
        sendTo(id, { type: "summary", summary: summaryWithClients() });
        break;
      }
      case "latest": {
        const limit = Math.max(1, Math.min(200, Number(msg.limit || 25)));
        sendTo(id, { type: "latest", mints: state.latestMints(limit) });
        break;
      }
      case "peer-hello": {
        me.isPeer = true;
        me.role = "peer";
        sendTo(id, {
          type: "peer-welcome",
          trackerId: state.trackerId,
          cursors: state.cursors(),
        });
        break;
      }
      case "broadcast-mint": {
        if (!msg.coin) return;
        recordMint(msg.coin as CoinV1, "peer:" + (me.peerUrl || me.id));
        break;
      }
      case "broadcast-spend": {
        if (typeof msg.nullifier !== "string") return;
        recordSpend(msg.nullifier, String(msg.coinSerialHash || ""), "peer");
        break;
      }
      case "sync-delta": {
        // Back-fill from a peer after we sent sync-request. Each mint/spend
        // still runs through recordMint/recordSpend so we validate PoW and
        // dedupe by serialHash/nullifier against local state.
        const peerSrc = "peer:" + (me.peerUrl || me.id);
        if (Array.isArray(msg.mints)) {
          for (const tm of msg.mints) {
            if (tm?.coin) recordMint(tm.coin as CoinV1, peerSrc);
          }
        }
        if (Array.isArray(msg.spends)) {
          for (const ts of msg.spends) {
            if (ts?.nullifier) {
              recordSpend(String(ts.nullifier), String(ts.coinSerialHash || ""), "peer");
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  function attachSocket(socket: Socket, acceptKey: string, peerUrl?: string): number {
    const id = nextId++;
    const client: ClientRecord = {
      id,
      socket,
      role: "client",
      label: "client " + id,
      pubKeyHash: "",
      buf: Buffer.alloc(0),
      alive: true,
      isPeer: Boolean(peerUrl),
      peerUrl,
    };
    clients.set(id, client);

    if (acceptKey) {
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n",
      );
    }

    socket.on("data", (chunk: Buffer) => {
      client.buf = Buffer.concat([client.buf, chunk]);
      const { frames, rest, error } = parseFrames(client.buf);
      if (error) {
        try { socket.end(encodeCloseFrame(1009, "too big")); } catch { /* */ }
        client.alive = false;
        return;
      }
      client.buf = rest;
      for (const frame of frames) {
        if (frame.opcode === 0x1) {
          handleClientMessage(id, frame.payload.toString("utf8"));
        } else if (frame.opcode === 0x8) {
          try { socket.end(encodeCloseFrame()); } catch { /* */ }
          client.alive = false;
        } else if (frame.opcode === 0x9) {
          try { socket.write(encodePong(frame.payload)); } catch { /* */ }
        }
      }
    });

    const cleanup = () => {
      if (!client.alive) return;
      client.alive = false;
      clients.delete(id);
      log(`[tracker] disconnect id=${id} role=${client.role}`);
    };
    socket.on("close", cleanup);
    socket.on("error", cleanup);
    socket.on("end", cleanup);

    return id;
  }

  // Peer gossip (outbound connections) ──────────────────────────────────────
  for (const peerUrl of opts.peers || []) {
    connectPeer(peerUrl);
  }

  function connectPeer(url: string, attempt = 0): void {
    try {
      const u = new URL(url);
      const isSecure = u.protocol === "wss:";
      const mod = isSecure ? https : http;
      const key = Buffer.from(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)))
        .toString("base64");
      const port = u.port || (isSecure ? 443 : 80);
      const req = mod.request(
        {
          hostname: u.hostname,
          port,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "Connection": "Upgrade",
            "Upgrade": "websocket",
            "Sec-WebSocket-Key": key,
            "Sec-WebSocket-Version": "13",
            "Host": u.hostname + ":" + port,
          },
        },
      );
      req.on("upgrade", (_res: any, sock: Socket) => {
        log(`[tracker] peer connected ${url}`);
        const id = attachSocket(sock, "", url);
        sendTo(id, { type: "peer-hello", trackerId: state.trackerId });
        sendTo(id, { type: "sync-request", sinceMintSeq: 0, sinceSpendSeq: 0 });
      });
      req.on("error", (err: Error) => {
        const backoff = Math.min(30_000, 1000 * Math.pow(2, attempt));
        log(`[tracker] peer ${url} error: ${err.message}; retrying in ${backoff}ms`);
        setTimeout(() => connectPeer(url, attempt + 1), backoff);
      });
      req.end();
    } catch (e) {
      log(`[tracker] peer ${url} init failed`, e);
    }
  }

  // HTTP + WS server ────────────────────────────────────────────────────────
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    if (req.url === "/summary") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(summaryWithClients()));
      return;
    }
    if (req.url === "/latest") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(state.latestMints(50)));
      return;
    }
    if (req.url === "/genome") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        genomeFingerprint,
        leadingTs,
        protocolVersion: 1,
      }));
      return;
    }
    if (req.url && req.url.startsWith("/mint?")) {
      // /mint?serial=<serialHash> — look up a single mint by its serial
      // hash. Used by wallets to fetch a batch-parent coin so they can
      // verify a child that arrived without its parent attached.
      try {
        const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const serial = (u.searchParams.get("serial") || "").trim();
        if (!serial) {
          res.writeHead(400, { "content-type": "text/plain" });
          res.end("missing ?serial=");
          return;
        }
        const m = state.allMints().find((x) => x.coin.serialHash === serial);
        if (!m) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "unknown serial" }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(m));
      } catch (e) {
        res.writeHead(400, { "content-type": "text/plain" });
        res.end("bad request: " + (e as Error).message);
      }
      return;
    }
    if (req.url && req.url.startsWith("/mints")) {
      // /mints?owner=<minerPubKeyDNA>[&unspent=1][&limit=N]
      //
      // Lookup coins by their miner pubkey. Used by `biocrypt-transfer`
      // to enumerate all coins authored by a given miner wallet so they
      // can be forwarded on to a frontend wallet or another recipient.
      try {
        const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const owner = (u.searchParams.get("owner") || "").trim();
        const unspent = u.searchParams.get("unspent") === "1";
        const limit = Math.min(Number(u.searchParams.get("limit") || 10000), 10000);
        const all = state.allMints();
        const filtered = all
          .filter((m) => !owner || m.coin.minerPubKeyDNA === owner)
          .filter((m) => !unspent || !m.spent)
          .slice(0, limit);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(filtered));
      } catch (e) {
        res.writeHead(400, { "content-type": "text/plain" });
        res.end("bad request: " + (e as Error).message);
      }
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });

  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"] as string | undefined;
    if (!key || (req.headers["upgrade"] || "").toString().toLowerCase() !== "websocket") {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    attachSocket(socket as Socket, wsAccept(key));
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const addr = server.address() as AddressInfo;
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${actualPort}`;
      log(`[tracker] listening on ${url} trackerId=${state.trackerId}`);
      log(`[tracker] genome=${genomeFingerprint.slice(0, 16)}... leadingTs=${leadingTs}`);

      // Keepalive: send WS ping to all clients every 25s. Long-idle
      // mining connections (PoW can take many minutes between submits)
      // would otherwise be silently torn down by reverse proxies such as
      // Apache's ProxyTimeout or nginx's proxy_read_timeout. Pinging
      // periodically keeps the upstream and downstream TCP alive;
      // clients pong back automatically.
      const pingFrame = Buffer.from([0x89, 0x00]);
      const keepaliveTimer = setInterval(() => {
        for (const c of clients.values()) {
          if (!c.alive) continue;
          try {
            c.socket.write(pingFrame);
          } catch {
            /* ignore, handled by socket error path */
          }
        }
      }, 25_000);
      keepaliveTimer.unref();

      resolve({
        port: actualPort,
        host,
        url,
        trackerId: state.trackerId,
        state,
        close: () =>
          new Promise<void>((r) => {
            state.persistNow();
            for (const c of clients.values()) {
              try { c.socket.destroy(); } catch { /* */ }
            }
            server.close(() => r());
          }),
      });
    });
  });
}

export { TrackerState } from "./state.js";
export { sha256 };
