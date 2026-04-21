/**
 * Tracker state: mints, spends, and pending envelope inboxes.
 * Persisted to a single JSON file on disk with debounced writes.
 */

import fs from "node:fs";
import path from "node:path";
import type { CoinV1 } from "@biocrypt/core";
import { isBatchChild } from "@biocrypt/core";

export interface TrackedMint {
  mintSeq: number;
  coin: CoinV1;
  receivedAt: number;
  spent: boolean;
  spentAt?: number;
  /** Sequence number of the PoW solve that produced this coin (1-based). */
  solveSeq?: number;
}

export interface TrackedSpend {
  spendSeq: number;
  nullifier: string;
  coinSerialHash: string;
  recordedAt: number;
  origin: "local" | "peer";
}

export interface PendingEnvelope {
  envelopeSeq: number;
  envelope: unknown;
  toPubKeyHash: string;
  coinSerialHash: string;
  nullifier: string;
  receivedAt: number;
}

export interface TrackerPersistShape {
  trackerId: string;
  mints: TrackedMint[];
  spends: TrackedSpend[];
  envelopes: PendingEnvelope[];
  cursors: { mint: number; spend: number; envelope: number; solve?: number };
  version: 1;
}

export class TrackerState {
  readonly trackerId: string;
  private mints = new Map<string, TrackedMint>(); // serialHash → mint
  private spends = new Map<string, TrackedSpend>(); // nullifier → spend
  private envelopes: PendingEnvelope[] = [];
  private mintSeqCursor = 0;
  private spendSeqCursor = 0;
  private envelopeSeqCursor = 0;
  private solveSeqCursor = 0;
  private dirty = false;
  private persistTimer: NodeJS.Timeout | null = null;
  private persistPath: string;

  constructor(persistPath: string, trackerId?: string) {
    this.persistPath = persistPath;
    this.trackerId = trackerId ?? this.loadOrCreate();
  }

  private loadOrCreate(): string {
    try {
      if (!fs.existsSync(this.persistPath)) {
        fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
        const fresh: TrackerPersistShape = {
          trackerId: "tr-" + Math.random().toString(16).slice(2, 10),
          mints: [],
          spends: [],
          envelopes: [],
          cursors: { mint: 0, spend: 0, envelope: 0 },
          version: 1,
        };
        fs.writeFileSync(this.persistPath, JSON.stringify(fresh, null, 2));
        return fresh.trackerId;
      }
      const raw = JSON.parse(fs.readFileSync(this.persistPath, "utf8")) as TrackerPersistShape;
      for (const m of raw.mints || []) {
        this.mints.set(m.coin.serialHash, m);
      }
      for (const s of raw.spends || []) {
        this.spends.set(s.nullifier, s);
      }
      this.envelopes = raw.envelopes || [];
      this.mintSeqCursor = raw.cursors?.mint ?? 0;
      this.spendSeqCursor = raw.cursors?.spend ?? 0;
      this.envelopeSeqCursor = raw.cursors?.envelope ?? 0;
      this.solveSeqCursor = raw.cursors?.solve ?? 0;
      return raw.trackerId || "tr-" + Math.random().toString(16).slice(2, 10);
    } catch (e) {
      console.error("[tracker] state load failed:", e);
      return "tr-" + Math.random().toString(16).slice(2, 10);
    }
  }

  private schedulePersist(): void {
    this.dirty = true;
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      if (!this.dirty) return;
      this.dirty = false;
      this.persistNow();
    }, 500);
  }

  persistNow(): void {
    const shape: TrackerPersistShape = {
      trackerId: this.trackerId,
      mints: [...this.mints.values()],
      spends: [...this.spends.values()],
      envelopes: this.envelopes,
      cursors: {
        mint: this.mintSeqCursor,
        spend: this.spendSeqCursor,
        envelope: this.envelopeSeqCursor,
        solve: this.solveSeqCursor,
      },
      version: 1,
    };
    const tmp = this.persistPath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(shape));
    fs.renameSync(tmp, this.persistPath);
  }

  hasMint(serialHash: string): boolean {
    return this.mints.has(serialHash);
  }

  hasSpend(nullifier: string): boolean {
    return this.spends.has(nullifier);
  }

  addMint(coin: CoinV1, opts: { solveSeq?: number } = {}): TrackedMint | null {
    if (this.mints.has(coin.serialHash)) return null;
    this.mintSeqCursor += 1;
    const record: TrackedMint = {
      mintSeq: this.mintSeqCursor,
      coin,
      receivedAt: Date.now(),
      spent: false,
      solveSeq: opts.solveSeq,
    };
    this.mints.set(coin.serialHash, record);
    this.schedulePersist();
    return record;
  }

  /**
   * Atomically record a batch of coins produced by one PoW solve.
   * The parent is pre-verified by the caller; children must have been
   * verified against the parent. Returns the resulting mint records in
   * batchIndex order, or null if the parent was already recorded OR any
   * child already exists (duplicate serialHash).
   */
  addBatch(parent: CoinV1, children: CoinV1[]): TrackedMint[] | null {
    if (this.mints.has(parent.serialHash)) return null;
    for (const c of children) {
      if (this.mints.has(c.serialHash)) return null;
    }
    this.solveSeqCursor += 1;
    const solveSeq = this.solveSeqCursor;
    const records: TrackedMint[] = [];
    for (const coin of [parent, ...children]) {
      this.mintSeqCursor += 1;
      const rec: TrackedMint = {
        mintSeq: this.mintSeqCursor,
        coin,
        receivedAt: Date.now(),
        spent: false,
        solveSeq,
      };
      this.mints.set(coin.serialHash, rec);
      records.push(rec);
    }
    this.schedulePersist();
    return records;
  }

  /** Count distinct PoW solves ever recorded. */
  get totalSolves(): number { return this.solveSeqCursor; }

  /**
   * Opportunistically re-count solves based on stored mints when a legacy
   * persistence file is loaded. Called exactly once at startup.
   */
  rehydrateSolveCursor(): void {
    if (this.solveSeqCursor > 0) return;
    const seen = new Set<number>();
    for (const m of this.mints.values()) {
      if (typeof m.solveSeq === "number") seen.add(m.solveSeq);
      else if (!isBatchChild(m.coin)) seen.add(m.mintSeq);
    }
    this.solveSeqCursor = seen.size;
  }

  addSpend(
    nullifier: string,
    coinSerialHash: string,
    origin: "local" | "peer" = "local",
  ): TrackedSpend | null {
    if (this.spends.has(nullifier)) return null;
    this.spendSeqCursor += 1;
    const rec: TrackedSpend = {
      spendSeq: this.spendSeqCursor,
      nullifier,
      coinSerialHash,
      recordedAt: Date.now(),
      origin,
    };
    this.spends.set(nullifier, rec);
    const mint = this.mints.get(coinSerialHash);
    if (mint && !mint.spent) {
      mint.spent = true;
      mint.spentAt = rec.recordedAt;
    }
    this.schedulePersist();
    return rec;
  }

  addEnvelope(entry: Omit<PendingEnvelope, "envelopeSeq" | "receivedAt">): PendingEnvelope {
    this.envelopeSeqCursor += 1;
    const rec: PendingEnvelope = {
      ...entry,
      envelopeSeq: this.envelopeSeqCursor,
      receivedAt: Date.now(),
    };
    this.envelopes.push(rec);
    this.schedulePersist();
    return rec;
  }

  inboxFor(toPubKeyHash: string): PendingEnvelope[] {
    return this.envelopes.filter((e) => e.toPubKeyHash === toPubKeyHash);
  }

  consumeInbox(toPubKeyHash: string): void {
    const before = this.envelopes.length;
    this.envelopes = this.envelopes.filter((e) => e.toPubKeyHash !== toPubKeyHash);
    if (this.envelopes.length !== before) this.schedulePersist();
  }

  mintsSince(mintSeq: number): TrackedMint[] {
    return [...this.mints.values()]
      .filter((m) => m.mintSeq > mintSeq)
      .sort((a, b) => a.mintSeq - b.mintSeq);
  }

  spendsSince(spendSeq: number): TrackedSpend[] {
    return [...this.spends.values()]
      .filter((s) => s.spendSeq > spendSeq)
      .sort((a, b) => a.spendSeq - b.spendSeq);
  }

  cursors(): { mint: number; spend: number; envelope: number } {
    return {
      mint: this.mintSeqCursor,
      spend: this.spendSeqCursor,
      envelope: this.envelopeSeqCursor,
    };
  }

  summary() {
    const mintList = [...this.mints.values()];
    const spentCount = mintList.filter((m) => m.spent).length;
    const last24h = mintList.filter((m) => Date.now() - m.receivedAt < 86400_000).length;
    return {
      trackerId: this.trackerId,
      totalMinted: mintList.length,
      totalSpent: spentCount,
      totalSolves: this.solveSeqCursor,
      last24h,
      pendingEnvelopes: this.envelopes.length,
      cursors: this.cursors(),
    };
  }

  latestMints(limit = 25): TrackedMint[] {
    return [...this.mints.values()]
      .sort((a, b) => b.mintSeq - a.mintSeq)
      .slice(0, limit);
  }

  /** Return every recorded mint, sorted by mintSeq ascending. */
  allMints(): TrackedMint[] {
    return [...this.mints.values()].sort((a, b) => a.mintSeq - b.mintSeq);
  }
}
