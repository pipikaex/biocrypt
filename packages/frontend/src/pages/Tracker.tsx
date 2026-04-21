import { useEffect, useMemo, useRef, useState } from "react";
import type { CoinV1 } from "@biocrypt/core";
import {
  TrackerClient,
  trackerHttp,
  TRACKER_WS_URL,
  type TrackedMint,
  type TrackedSpend,
  type TrackerSummary,
  type TrackerGenome,
} from "../trackerClient";

interface FeedItem {
  kind: "mint" | "spend";
  at: number;
  mint?: TrackedMint;
  spend?: TrackedSpend;
}

export function Tracker() {
  const [summary, setSummary] = useState<TrackerSummary | null>(null);
  const [genome, setGenome] = useState<TrackerGenome | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [spentSet, setSpentSet] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"offline" | "connecting" | "online">("offline");
  const [selected, setSelected] = useState<TrackedMint | null>(null);
  const clientRef = useRef<TrackerClient | null>(null);

  const MAX_FEED = 200;

  const pushMint = (m: TrackedMint) => {
    setFeed((prev) => {
      if (prev.some((it) => it.kind === "mint" && it.mint?.coin.serialHash === m.coin.serialHash)) {
        return prev;
      }
      const next: FeedItem[] = [
        { kind: "mint", at: m.coin.minedAt || Date.now(), mint: m },
        ...prev,
      ];
      return next.slice(0, MAX_FEED);
    });
  };

  const pushSpend = (s: TrackedSpend) => {
    setFeed((prev) => {
      if (prev.some((it) => it.kind === "spend" && it.spend?.nullifier === s.nullifier)) {
        return prev;
      }
      const next: FeedItem[] = [
        { kind: "spend", at: s.at || Date.now(), spend: s },
        ...prev,
      ];
      return next.slice(0, MAX_FEED);
    });
    setSpentSet((prev) => {
      const next = new Set(prev);
      next.add(s.coinSerialHash);
      return next;
    });
  };

  useEffect(() => {
    const client = new TrackerClient({ role: "tracker-viewer", label: "web" });
    clientRef.current = client;
    setStatus("connecting");

    const off = client.on((msg) => {
      if (msg.type === "welcome") {
        setStatus("online");
        setGenome({
          genomeFingerprint: msg.genomeFingerprint,
          leadingTs: msg.leadingTs,
          protocolVersion: 1,
        });
        setSummary(msg.summary);
        client.requestLatest(100);
        client.requestSync(0, 0);
      } else if (msg.type === "latest") {
        const mints = (msg as any).mints as TrackedMint[];
        setFeed((prev) => {
          const merged = [...prev];
          for (const m of mints) {
            if (!merged.some((it) => it.kind === "mint" && it.mint?.coin.serialHash === m.coin.serialHash)) {
              merged.push({ kind: "mint", at: m.coin.minedAt || Date.now(), mint: m });
            }
          }
          merged.sort((a, b) => b.at - a.at);
          return merged.slice(0, MAX_FEED);
        });
      } else if (msg.type === "sync-delta") {
        const mints = (msg as any).mints as TrackedMint[];
        const spends = (msg as any).spends as TrackedSpend[];
        for (const m of mints) pushMint(m);
        for (const s of spends) pushSpend(s);
      } else if (msg.type === "broadcast-mint") {
        const m: TrackedMint = {
          coin: (msg as any).coin,
          mintSeq: (msg as any).mintSeq,
          receivedAt: Date.now(),
        };
        pushMint(m);
        setSummary((prev) => (prev ? { ...prev, totalMinted: prev.totalMinted + 1 } : prev));
      } else if (msg.type === "broadcast-spend") {
        const s: TrackedSpend = {
          nullifier: (msg as any).nullifier,
          coinSerialHash: (msg as any).coinSerialHash,
          spendSeq: (msg as any).spendSeq,
          at: Date.now(),
        };
        pushSpend(s);
        setSummary((prev) => (prev ? { ...prev, totalSpent: prev.totalSpent + 1 } : prev));
      } else if (msg.type === "summary") {
        setSummary((msg as any).summary);
      }
    });

    client.connect();

    const pollTimer = window.setInterval(() => {
      trackerHttp.summary().then(setSummary).catch(() => {});
    }, 20000);

    return () => {
      off();
      client.close();
      clientRef.current = null;
      window.clearInterval(pollTimer);
      setStatus("offline");
    };
  }, []);

  useEffect(() => {
    trackerHttp.genome().then(setGenome).catch(() => {});
    trackerHttp.summary().then(setSummary).catch(() => {});
  }, []);

  const unspent = summary ? Math.max(0, summary.totalMinted - summary.totalSpent) : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return feed;
    return feed.filter((it) => {
      if (it.kind === "mint" && it.mint) {
        const c = it.mint.coin;
        return (
          c.serialHash.toLowerCase().includes(q) ||
          c.serial.toLowerCase().includes(q) ||
          c.minerPubKeyDNA.toLowerCase().includes(q)
        );
      }
      if (it.kind === "spend" && it.spend) {
        return (
          it.spend.nullifier.toLowerCase().includes(q) ||
          it.spend.coinSerialHash.toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [feed, query]);

  return (
    <div className="page">
      <h1>Coin Tracker</h1>
      <p className="text-muted mb-2" style={{ maxWidth: 720 }}>
        Live feed from <code>{TRACKER_WS_URL}</code>. Every CoinV1 minted on the
        network is broadcast here as soon as the tracker verifies its
        proof-of-work and miner signature. Spends show up the moment a nullifier
        is published.
      </p>

      <div className="net-hero mb-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem" }}>
        <HeroStat label="Total Minted" value={summary?.totalMinted ?? "..."} />
        <HeroStat label="Total Spent"  value={summary?.totalSpent ?? "..."} />
        <HeroStat label="Unspent"      value={summary ? unspent : "..."} />
        <HeroStat label="Tracker"      value={status === "online" ? "LIVE" : status.toUpperCase()} color={status === "online" ? "var(--primary)" : "var(--warning)"} />
      </div>

      <div className="card mb-2" style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter serial / nullifier / miner pubkey..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 280, flex: 1 }}
        />
        {genome?.genomeFingerprint && (
          <div className="mono text-xs text-muted" style={{ alignSelf: "center" }}>
            genome {genome.genomeFingerprint.slice(0, 12)}...&nbsp;&middot;&nbsp;
            {genome.leadingTs} leading T
          </div>
        )}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <div className="text-muted text-xs">
              {status === "online"
                ? "Waiting for first event..."
                : "Connecting to tracker..."}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tracker-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Serial / Nullifier</th>
                  <th>Miner / Seq</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it, idx) => {
                  if (it.kind === "mint" && it.mint) {
                    const c = it.mint.coin;
                    const isSpent = spentSet.has(c.serialHash);
                    return (
                      <tr key={`m-${c.serialHash}-${idx}`} onClick={() => setSelected(it.mint!)} style={{ cursor: "pointer" }}>
                        <td>
                          <span className="src-badge" style={{ background: "#00e59922", color: "var(--primary)", border: "1px solid #00e59955" }}>
                            MINT{isSpent ? " (spent)" : ""}
                          </span>
                        </td>
                        <td className="mono text-xs" style={{ wordBreak: "break-all" }}>
                          {c.serialHash.slice(0, 40)}...
                        </td>
                        <td className="mono text-xs">
                          {c.minerPubKeyDNA.slice(0, 12)}... &middot; #{it.mint.mintSeq}
                        </td>
                        <td className="text-xs text-muted">{formatTime(it.at)}</td>
                      </tr>
                    );
                  }
                  if (it.kind === "spend" && it.spend) {
                    return (
                      <tr key={`s-${it.spend.nullifier}-${idx}`}>
                        <td>
                          <span className="src-badge" style={{ background: "#f8514922", color: "var(--danger)", border: "1px solid #f8514955" }}>
                            SPEND
                          </span>
                        </td>
                        <td className="mono text-xs" style={{ wordBreak: "break-all" }}>
                          {it.spend.nullifier.slice(0, 40)}...
                        </td>
                        <td className="mono text-xs">
                          coin {it.spend.coinSerialHash.slice(0, 12)}... &middot; #{it.spend.spendSeq}
                        </td>
                        <td className="text-xs text-muted">{formatTime(it.at)}</td>
                      </tr>
                    );
                  }
                  return null;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0 }}>CoinV1 Details</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
            <CoinDetail mint={selected} spent={spentSet.has(selected.coin.serialHash)} />
          </div>
        </div>
      )}

      <style>{trackerStyles}</style>
    </div>
  );
}

function CoinDetail({ mint, spent }: { mint: TrackedMint; spent: boolean }) {
  const c: CoinV1 = mint.coin;
  return (
    <div className="grid-2">
      <Field label="Serial" value={c.serial} mono wrap />
      <Field label="Serial Hash" value={c.serialHash} mono wrap />
      <Field label="Mint Seq" value={`#${mint.mintSeq}`} />
      <Field label="Spent" value={spent ? "YES" : "NO"} color={spent ? "var(--danger)" : "var(--primary)"} />
      <Field label="Leading T" value={String(c.miningProof.leadingTs)} />
      <Field label="Nonce" value={String(c.miningProof.nonce)} />
      <Field label="Protocol" value={`v${c.protocolVersion}`} />
      <Field label="Genome fp" value={c.networkGenomeFingerprint} mono wrap />
      <Field label="Mined" value={new Date(c.minedAt).toLocaleString()} />
      <Field label="Miner pubkey" value={c.minerPubKeyDNA} mono wrap />
      <div style={{ gridColumn: "1 / -1" }}>
        <Field label="Miner signature" value={c.minerSignatureDNA} mono wrap />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <Field label="Coin gene" value={c.coinGene} mono wrap />
      </div>
    </div>
  );
}

function HeroStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "0.9rem 0.6rem" }}>
      <div className="mono" style={{ fontSize: "1.4rem", color: color ?? "var(--primary)", fontWeight: 700 }}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Field({ label, value, mono, wrap, color }: { label: string; value: string; mono?: boolean; wrap?: boolean; color?: string }) {
  return (
    <div>
      <div className="text-xs text-muted" style={{ marginBottom: "0.2rem" }}>{label}</div>
      <div
        className={mono ? "mono text-xs" : "text-xs"}
        style={{ color: color ?? "var(--text)", wordBreak: wrap ? "break-all" : "normal" }}
      >
        {value}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

const trackerStyles = `
.tracker-table th, .tracker-table td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.tracker-table th {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  font-weight: 600;
}
.tracker-table tbody tr:hover {
  background: var(--primary-glow);
}
.src-badge {
  display: inline-block;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 1rem;
  animation: fadeIn 0.15s;
}
.modal {
  max-width: 720px; width: 100%;
  max-height: 90vh; overflow-y: auto;
}
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;
