import type { CoinV1 } from "@biocrypt/core";

export const TRACKER_WS_URL =
  import.meta.env.VITE_TRACKER_WS_URL || "wss://tracker.biocrypt.net";
export const TRACKER_HTTP_URL =
  import.meta.env.VITE_TRACKER_HTTP_URL || "https://tracker.biocrypt.net";

export interface TrackerSummary {
  trackerId: string;
  totalMinted: number;
  totalSpent: number;
  last24h?: number;
  pendingEnvelopes?: number;
  peers?: number;
  latestMintAt?: number;
  latestSpendAt?: number;
}

export interface TrackerGenome {
  genomeFingerprint: string;
  leadingTs: number;
  protocolVersion: number;
  networkId?: string;
}

export interface TrackedMint {
  coin: CoinV1;
  mintSeq: number;
  receivedAt: number;
  source?: string;
}

export interface TrackedSpend {
  nullifier: string;
  coinSerialHash: string;
  spendSeq: number;
  at: number;
}

export interface TrackerEnvelope {
  envelope: any;
  envelopeSeq: number;
  createdAt?: number;
  toPubKeyHash?: string;
  coinSerialHash?: string;
  nullifier?: string;
}

export type TrackerMessage =
  | { type: "welcome"; clientId: number; trackerId: string; genomeFingerprint: string; leadingTs: number; summary: TrackerSummary }
  | { type: "mint-ack"; serialHash: string; mintSeq: number }
  | { type: "mint-reject"; serialHash?: string; reason: string }
  | { type: "spend-ack"; nullifier: string; spendSeq: number }
  | { type: "spend-reject"; nullifier?: string; reason: string }
  | { type: "broadcast-mint"; coin: CoinV1; mintSeq: number }
  | { type: "broadcast-spend"; nullifier: string; coinSerialHash: string; spendSeq: number }
  | { type: "envelope"; envelope: any; envelopeSeq: number }
  | { type: "inbox"; pubKeyHash: string; envelopes: TrackerEnvelope[] }
  | { type: "summary"; summary: TrackerSummary }
  | { type: "latest"; mints: TrackedMint[] }
  | { type: "sync-delta"; mints: TrackedMint[]; spends: TrackedSpend[]; cursors: { mintSeq: number; spendSeq: number } }
  | { type: string; [k: string]: any };

type Listener = (msg: TrackerMessage) => void;

export interface ConnectOpts {
  role?: string;
  label?: string;
  pubKeyHash?: string;
  url?: string;
}

/**
 * Browser WebSocket client for the BioCrypt tracker.
 * Handles reconnection with exponential backoff and exposes a simple
 * listener API.
 */
export class TrackerClient {
  private ws: WebSocket | null = null;
  private url: string;
  private opts: ConnectOpts;
  private listeners = new Set<Listener>();
  private openWaiters: Array<() => void> = [];
  private closed = false;
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private _ready = false;
  private _welcome: (TrackerMessage & { type: "welcome" }) | null = null;

  constructor(opts: ConnectOpts = {}) {
    this.opts = opts;
    this.url = opts.url || TRACKER_WS_URL;
  }

  get ready(): boolean {
    return this._ready;
  }

  get welcome() {
    return this._welcome;
  }

  connect(): void {
    if (this.ws || this.closed) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.send({
        type: "hello",
        role: this.opts.role || "browser-miner",
        label: this.opts.label || "browser",
        pubKeyHash: this.opts.pubKeyHash || "",
      });
    };
    this.ws.onmessage = (ev) => {
      let msg: TrackerMessage;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      if (msg.type === "welcome") {
        this._welcome = msg as any;
        this._ready = true;
        const waiters = this.openWaiters.slice();
        this.openWaiters = [];
        for (const w of waiters) w();
      }
      for (const l of this.listeners) {
        try {
          l(msg);
        } catch {
          /* */
        }
      }
    };
    this.ws.onclose = () => {
      this.ws = null;
      this._ready = false;
      if (!this.closed) this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      try {
        this.ws?.close();
      } catch {
        /* */
      }
    };
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      /* */
    }
    this.ws = null;
    this._ready = false;
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  waitForReady(timeoutMs = 5000): Promise<void> {
    if (this._ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("tracker connect timeout")), timeoutMs);
      this.openWaiters.push(() => {
        clearTimeout(to);
        resolve();
      });
    });
  }

  send(obj: unknown): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* */
    }
  }

  sendMint(coin: CoinV1): void {
    this.send({ type: "mint", coin });
  }

  sendSpend(nullifier: string, coinSerialHash: string, envelope?: any): void {
    this.send({ type: "spend", nullifier, coinSerialHash, envelope });
  }

  requestSummary(): void {
    this.send({ type: "summary" });
  }

  requestLatest(limit = 50): void {
    this.send({ type: "latest", limit });
  }

  requestSync(sinceMintSeq = 0, sinceSpendSeq = 0): void {
    this.send({ type: "sync-request", sinceMintSeq, sinceSpendSeq });
  }

  fetchInbox(pubKeyHash: string, consume = false): void {
    this.send({ type: "fetch-inbox", pubKeyHash, consume });
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer != null) return;
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

/* HTTP convenience helpers ----------------------------------------------- */

async function tFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${TRACKER_HTTP_URL}${path}`);
  if (!res.ok) throw new Error(`tracker ${path} -> ${res.status}`);
  return res.json();
}

export const trackerHttp = {
  genome: () => tFetch<TrackerGenome>("/genome"),
  summary: () => tFetch<TrackerSummary>("/summary"),
  latest: () => tFetch<TrackedMint[]>("/latest"),
  health: () => tFetch<{ ok: boolean }>("/healthz").catch(() => ({ ok: false })),
};

/* Shared singleton ------------------------------------------------------- */

let shared: TrackerClient | null = null;

/**
 * Return the process-wide tracker client, creating and connecting it on first
 * use. Callers that need their own connection (with a specific role/pubKeyHash)
 * should construct a TrackerClient directly.
 */
export function getSharedTracker(): TrackerClient {
  if (!shared) {
    shared = new TrackerClient({ role: "biocrypt-web", label: "web" });
    shared.connect();
  }
  return shared;
}
