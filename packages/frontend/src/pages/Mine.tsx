import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  DEFAULT_BODY_LENGTH,
  signCoinWithMiner,
  verifyCoinV1,
  GENESIS_LEADING_TS,
  type CoinV1,
} from "@biocrypt/core";
import { useStore } from "../store";
import { ProteinBar } from "../ProteinBar";
import {
  TrackerClient,
  trackerHttp,
  TRACKER_WS_URL,
  type TrackerSummary,
  type TrackerGenome,
} from "../trackerClient";
import { deriveMinerKey } from "../minerKey";
import { playSfx, isSfxMuted, setSfxMuted, SFX } from "../sfx";

export function Mine() {
  const wallet = useStore((s) => s.wallet);
  const mining = useStore((s) => s.mining);
  const coins = useStore((s) => s.coins);
  const setMining = useStore((s) => s.setMining);
  const addCoin = useStore((s) => s.addCoin);
  const updateCoin = useStore((s) => s.updateCoin);
  const removeCoin = useStore((s) => s.removeCoin);
  const integrateCoin = useStore((s) => s.integrateCoinIntoWalletDNA);
  const addToast = useStore((s) => s.addToast);

  const [leadingTs, setLeadingTs] = useState<number>(GENESIS_LEADING_TS);
  const [bodyLength, setBodyLength] = useState(DEFAULT_BODY_LENGTH);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [genome, setGenome] = useState<TrackerGenome | null>(null);
  const [summary, setSummary] = useState<TrackerSummary | null>(null);
  const [trackerStatus, setTrackerStatus] = useState<"offline" | "connecting" | "online">("offline");
  const [miningTime, setMiningTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => isSfxMuted());

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setSfxMuted(next);
      return next;
    });
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clientRef = useRef<TrackerClient | null>(null);
  const pendingAcksRef = useRef<Map<string, { coinGene: string }>>(new Map());

  const signedCoins = useMemo(() => coins.filter((c) => c.signed), [coins]);
  const unsignedCoins = useMemo(() => coins.filter((c) => !c.signed), [coins]);

  // Derive deterministic miner identity from the wallet
  const minerKey = useMemo(() => {
    if (!wallet?.privateKeyDNA) return null;
    try {
      return deriveMinerKey(wallet.privateKeyDNA);
    } catch {
      return null;
    }
  }, [wallet?.privateKeyDNA]);

  /* ─── Tracker connection ─────────────────────────────────────────── */

  useEffect(() => {
    if (!wallet) return;
    const client = new TrackerClient({
      role: "browser-miner",
      label: `web-${wallet.publicKeyHash.slice(0, 8)}`,
      pubKeyHash: wallet.publicKeyHash,
    });
    clientRef.current = client;
    setTrackerStatus("connecting");

    const off = client.on((msg) => {
      if (msg.type === "welcome") {
        setTrackerStatus("online");
        setGenome({
          genomeFingerprint: msg.genomeFingerprint,
          leadingTs: msg.leadingTs,
          protocolVersion: 1,
        });
        setSummary(msg.summary);
        if (typeof msg.leadingTs === "number") setLeadingTs(msg.leadingTs);
        // keep worker in sync with latest difficulty
        workerRef.current?.postMessage({
          type: "updateTarget",
          target: "",
          difficulty: "T".repeat(msg.leadingTs),
          leadingTs: msg.leadingTs,
          blockReward: 1,
        });
      } else if (msg.type === "mint-ack") {
        const rec = pendingAcksRef.current.get(msg.serialHash);
        pendingAcksRef.current.delete(msg.serialHash);
        updateCoin(msg.serialHash, { signed: true, mintSeq: msg.mintSeq });
        if (rec?.coinGene) integrateCoin(rec.coinGene);
        setSubmitting(null);
        addToast("success", `Coin accepted by tracker (#${msg.mintSeq})`);
      } else if (msg.type === "mint-reject") {
        const hash = (msg as any).serialHash as string | undefined;
        if (hash) {
          pendingAcksRef.current.delete(hash);
          removeCoin(hash);
        }
        setSubmitting(null);
        addToast("error", `Tracker rejected coin: ${msg.reason}`);
      } else if (msg.type === "summary") {
        setSummary((msg as any).summary);
      } else if (msg.type === "broadcast-mint") {
        setSummary((prev) =>
          prev ? { ...prev, totalMinted: prev.totalMinted + 1 } : prev,
        );
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
      setTrackerStatus("offline");
    };
  }, [wallet?.publicKeyHash, addToast, integrateCoin, removeCoin, updateCoin]);

  useEffect(() => {
    trackerHttp.genome().then(setGenome).catch(() => {});
    trackerHttp.summary().then(setSummary).catch(() => {});
  }, []);

  /* ─── Mining timer ───────────────────────────────────────────────── */

  useEffect(() => {
    if (mining.active) {
      timerRef.current = setInterval(() => setMiningTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setMiningTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mining.active]);

  /* ─── Submit a PoW result as a v1 CoinV1 to the tracker ──────────── */

  const submitCoin = useCallback(
    (rawCoin: {
      coinGene: string;
      serial: string;
      serialHash: string;
      nonce: number;
      hash: string;
      difficulty: string;
      leadingTs: number;
      minedAt: number;
    }) => {
      const client = clientRef.current;
      if (!client || !client.ready) {
        addToast("error", "Tracker offline — coin kept locally, will retry.");
        return;
      }
      if (!minerKey) {
        addToast("error", "Wallet missing private key — cannot sign coin.");
        return;
      }
      if (!genome?.genomeFingerprint) {
        addToast("error", "Network genome not loaded yet.");
        return;
      }
      setSubmitting(rawCoin.serialHash);

      try {
        const signed: CoinV1 = signCoinWithMiner(
          {
            coinGene: rawCoin.coinGene,
            serial: rawCoin.serial,
            serialHash: rawCoin.serialHash,
            nonce: rawCoin.nonce,
            hash: rawCoin.hash,
            difficulty: rawCoin.difficulty,
            minedAt: rawCoin.minedAt,
          } as any,
          minerKey.privateKeyDNA,
          genome.genomeFingerprint,
        );
        const verify = verifyCoinV1(signed, {
          expectedGenomeFingerprint: genome.genomeFingerprint,
        });
        if (!verify.ok) {
          addToast("error", `Self-check failed: ${verify.reason}`);
          setSubmitting(null);
          return;
        }
        updateCoin(rawCoin.serialHash, {
          protocolVersion: 1,
          networkGenomeFingerprint: signed.networkGenomeFingerprint,
          minerPubKeyDNA: signed.minerPubKeyDNA,
          minerSignatureDNA: signed.minerSignatureDNA,
          leadingTs: signed.miningProof.leadingTs,
          source: "browser",
        });
        pendingAcksRef.current.set(signed.serialHash, {
          coinGene: signed.coinGene,
        });
        client.sendMint(signed);
      } catch (e: any) {
        setSubmitting(null);
        addToast("error", `Signing failed: ${e?.message || e}`);
      }
    },
    [minerKey, genome?.genomeFingerprint, addToast, updateCoin],
  );

  /* ─── Mining control ─────────────────────────────────────────────── */

  const startMining = useCallback(async () => {
    if (!wallet) {
      addToast("error", "Create a wallet first.");
      return;
    }
    if (!minerKey) {
      addToast("error", "Wallet is watch-only (no private key).");
      return;
    }
    if (workerRef.current) workerRef.current.terminate();

    // Ensure we have the live difficulty before starting.
    try {
      const g = await trackerHttp.genome();
      setGenome(g);
      if (typeof g.leadingTs === "number") setLeadingTs(g.leadingTs);
    } catch {
      /* run with last known difficulty */
    }

    const worker = new Worker(
      new URL("../workers/miner.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === "progress") {
        setMining({ hashrate: msg.hashrate, currentNonce: msg.nonce });
      } else if (msg.type === "result") {
        const coin = {
          coinGene: msg.coinGene,
          serial: msg.serial,
          serialHash: msg.serialHash,
          aminoAcids: msg.aminoAcids,
          nonce: msg.nonce,
          hash: msg.hash,
          difficulty: msg.difficulty,
          minedAt: msg.minedAt,
          leadingTs: msg.leadingTs,
          signed: false,
          source: "browser" as const,
        };
        addCoin(coin);
        playSfx(SFX.coinMined, 0.6);
        addToast("success", `PoW found. Serial ${msg.serialHash.slice(0, 12)}...`);

        if (autoSubmit) {
          submitCoin(coin);
        }
      }
    };

    worker.postMessage({
      type: "start",
      target: "",
      difficulty: "T".repeat(leadingTs),
      leadingTs,
      bodyLength,
      blockReward: 1,
    });
    workerRef.current = worker;
    setMining({ active: true, hashrate: 0, currentNonce: 0 });
  }, [wallet, minerKey, leadingTs, bodyLength, autoSubmit, addToast, addCoin, setMining, submitCoin]);

  const stopMining = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "stop" });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setMining({ active: false, hashrate: 0 });
  }, [setMining]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="page">
      <h1>Mine Coins</h1>
      <p className="text-muted mb-2" style={{ maxWidth: 600 }}>
        Use your browser to mine <strong>CoinV1</strong>. Each PoW solution is
        signed by your wallet&apos;s Ed25519 key and submitted over WebSocket
        directly to <code>{TRACKER_WS_URL}</code>. No server-side signing, no
        network private key.
      </p>

      {!wallet ? (
        <div className="empty-state">
          <div className="empty-icon">{"\u26CF\uFE0F"}</div>
          <div className="empty-title">Wallet Required</div>
          <div className="empty-desc">
            You need a wallet to store mined coins. Create one to start mining.
          </div>
          <Link to="/wallet" className="btn btn-primary">
            Create Wallet
          </Link>
        </div>
      ) : (
        <>
          {/* Mining Control Panel */}
          <div className={`mine-panel card ${mining.active ? "card-accent" : ""}`}>
            <div className="mine-header">
              <div className="mine-status-area">
                {mining.active ? (
                  <div className="mine-active-indicator">
                    <div className="mine-helix">
                      <div className="helix-strand" />
                      <div className="helix-strand s2" />
                    </div>
                    <div>
                      <div className="text-primary" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                        Mining Active
                      </div>
                      <div className="text-muted text-xs">
                        {formatTime(miningTime)} elapsed
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>Ready to Mine</div>
                    <div className="text-muted text-xs">
                      Click start to begin proof-of-work computation
                    </div>
                  </div>
                )}
              </div>
              <div>
                {mining.active ? (
                  <button className="btn btn-danger" onClick={stopMining}>
                    Stop Mining
                  </button>
                ) : (
                  <button className="btn btn-primary btn-glow" onClick={startMining}>
                    Start Mining
                  </button>
                )}
              </div>
            </div>

            {/* Live stats */}
            <div className="mine-stats">
              <div className="mine-stat">
                <div className="mine-stat-value">{formatHashrate(mining.hashrate)}</div>
                <div className="mine-stat-label">Hashrate</div>
              </div>
              <div className="mine-stat">
                <div className="mine-stat-value">{mining.currentNonce.toLocaleString()}</div>
                <div className="mine-stat-label">Nonce</div>
              </div>
              <div className="mine-stat">
                <div className="mine-stat-value">{mining.totalMined}</div>
                <div className="mine-stat-label">Session</div>
              </div>
              <div className="mine-stat">
                <div className="mine-stat-value">{signedCoins.length}</div>
                <div className="mine-stat-label">Accepted</div>
              </div>
              <div className="mine-stat">
                <div className="mine-stat-value">{summary?.totalMinted ?? "..."}</div>
                <div className="mine-stat-label">Net. Minted</div>
              </div>
              <div className="mine-stat">
                <div className={`mine-stat-value ${trackerStatus === "online" ? "text-primary" : ""}`}>
                  {trackerStatus === "online" ? "ONLINE" : trackerStatus.toUpperCase()}
                </div>
                <div className="mine-stat-label">Tracker</div>
              </div>
            </div>

            {/* Difficulty info */}
            <div className="mine-difficulty">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-muted">
                  Network Difficulty (DNA256)
                </span>
                <span className="mono text-sm text-primary">
                  {leadingTs} leading T&#x2009;nucleotides
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, leadingTs * 5)}%` }}
                />
              </div>
              {genome?.genomeFingerprint && (
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted mono">
                    genome {genome.genomeFingerprint.slice(0, 16)}...
                  </span>
                  <span className="text-xs text-muted">
                    protocol v{genome.protocolVersion}
                  </span>
                </div>
              )}
            </div>

            {/* Miner identity */}
            {minerKey && (
              <div className="mine-difficulty" style={{ marginTop: "0.75rem" }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-muted">Miner public key</span>
                  <span className="mono text-xs text-muted">Ed25519</span>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: "0.72rem",
                    wordBreak: "break-all",
                    opacity: 0.8,
                  }}
                >
                  {minerKey.publicKeyDNA}
                </div>
              </div>
            )}

            {/* Advanced settings toggle */}
            <div className="mine-settings-toggle">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setShowSettings(!showSettings)}
              >
                {showSettings ? "Hide Settings" : "Advanced Settings"}
              </button>
              <label className="mine-checkbox">
                <input
                  type="checkbox"
                  checked={autoSubmit}
                  onChange={(e) => setAutoSubmit(e.target.checked)}
                />
                <span className="text-sm">Auto-submit to tracker</span>
              </label>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={toggleMute}
                title={muted ? "Unmute coin-mined sound" : "Mute coin-mined sound"}
                aria-label={muted ? "Unmute coin-mined sound" : "Mute coin-mined sound"}
              >
                {muted ? "\u{1F507} Sound off" : "\u{1F50A} Sound on"}
              </button>
            </div>

            {showSettings && (
              <div className="mine-advanced">
                <div className="field">
                  <label className="label">Coin body length (codons)</label>
                  <input
                    className="input input-mono"
                    type="number"
                    value={bodyLength}
                    onChange={(e) => setBodyLength(Number(e.target.value))}
                    disabled={mining.active}
                    min={30}
                    max={300}
                  />
                  <span className="text-xs text-muted mt-05">
                    Higher = more complex proteins, stronger security. Default: {DEFAULT_BODY_LENGTH}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Unsigned coins */}
          {unsignedCoins.length > 0 && (
            <div className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <h2 style={{ margin: 0 }}>Pending Submission ({unsignedCoins.length})</h2>
              </div>
              <p className="text-muted text-sm mb-2">
                These coins have valid PoW but haven&apos;t been accepted by the tracker yet.
              </p>
              {unsignedCoins.map((c) => (
                <div
                  key={c.serialHash}
                  className="card mb-1 flex justify-between items-center flex-wrap"
                  style={{ gap: "0.75rem" }}
                >
                  <div className="flex items-center gap-1">
                    <span className="badge badge-warning">Unsubmitted</span>
                    {c.aminoAcids ? (
                      <ProteinBar aminoAcids={c.aminoAcids} height={10} maxWidth={140} />
                    ) : (
                      <span className="mono text-xs">
                        {c.serialHash.slice(0, 20)}...
                      </span>
                    )}
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      submitCoin({
                        coinGene: c.coinGene,
                        serial: c.serial,
                        serialHash: c.serialHash,
                        nonce: c.nonce,
                        hash: c.hash,
                        difficulty: c.difficulty,
                        leadingTs: c.leadingTs ?? leadingTs,
                        minedAt: c.minedAt,
                      })
                    }
                    disabled={submitting === c.serialHash}
                  >
                    {submitting === c.serialHash ? "Submitting..." : "Submit to Tracker"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recent accepted coins */}
          {signedCoins.length > 0 && (
            <div className="mt-3">
              <h2>Recently Accepted ({signedCoins.length})</h2>
              <div className="mine-signed-grid">
                {signedCoins
                  .slice(-8)
                  .reverse()
                  .map((c) => (
                    <div key={c.serialHash} className="mine-signed-card">
                      <div className="flex justify-between items-center">
                        <span className="badge badge-primary">
                          {c.mintSeq != null ? `#${c.mintSeq}` : "Accepted"}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(c.minedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1">
                        {c.aminoAcids ? (
                          <ProteinBar aminoAcids={c.aminoAcids} height={10} />
                        ) : (
                          <div className="mono text-xs truncate">{c.serialHash}</div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-1 text-xs text-muted">
                        <span>Nonce: {c.nonce.toLocaleString()}</span>
                        <span>lts: {c.leadingTs ?? leadingTs}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="mine-explainer mt-3">
            <h2>How Mining Works (v1)</h2>
            <div className="mine-steps">
              <div className="mine-step-card">
                <div className="mine-step-num">1</div>
                <h3>Generate</h3>
                <p className="text-muted text-sm">
                  A random DNA coin gene is created in your browser with the coin protein header.
                </p>
              </div>
              <div className="mine-step-arrow">{"\u2192"}</div>
              <div className="mine-step-card">
                <div className="mine-step-num">2</div>
                <h3>Prove</h3>
                <p className="text-muted text-sm">
                  Find a nonce where the DNA256 PoW strand starts with {leadingTs}+ T bases.
                </p>
              </div>
              <div className="mine-step-arrow">{"\u2192"}</div>
              <div className="mine-step-card">
                <div className="mine-step-num">3</div>
                <h3>Sign</h3>
                <p className="text-muted text-sm">
                  Your wallet Ed25519 key signs the coin locally. No network private key required.
                </p>
              </div>
              <div className="mine-step-arrow">{"\u2192"}</div>
              <div className="mine-step-card">
                <div className="mine-step-num">4</div>
                <h3>Gossip</h3>
                <p className="text-muted text-sm">
                  The signed CoinV1 is streamed to every tracker peer over WebSocket.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{mineStyles}</style>
    </div>
  );
}

function formatHashrate(h: number): string {
  if (h === 0) return "0";
  if (h > 1_000_000) return `${(h / 1_000_000).toFixed(1)}M H/s`;
  if (h > 1_000) return `${(h / 1_000).toFixed(1)}K H/s`;
  return `${h} H/s`;
}

const mineStyles = `
/* Mine panel */
.mine-panel { margin-bottom: 0; }
.mine-header {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;
}
.mine-status-area { display: flex; align-items: center; gap: 1rem; }
.mine-active-indicator { display: flex; align-items: center; gap: 1rem; }

/* Animated DNA helix */
.mine-helix {
  width: 40px; height: 40px; position: relative;
}
.helix-strand {
  position: absolute; inset: 0;
  border: 3px solid transparent;
  border-top-color: var(--primary);
  border-bottom-color: var(--secondary);
  border-radius: 50%;
  animation: helixSpin 1.2s linear infinite;
}
.helix-strand.s2 {
  animation-delay: -0.6s; opacity: 0.5;
  border-top-color: var(--secondary);
  border-bottom-color: var(--primary);
}
@keyframes helixSpin { to { transform: rotate(360deg); } }

/* Mine stats */
.mine-stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem; margin-bottom: 1.5rem;
}
.mine-stat {
  text-align: center; padding: 0.75rem;
  background: var(--bg-surface); border-radius: var(--radius);
  border: 1px solid var(--border);
}
.mine-stat-value {
  font-family: var(--mono); font-size: 1.15rem; font-weight: 700; color: var(--primary);
}
.mine-stat-label { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.15rem; }

/* Difficulty */
.mine-difficulty {
  padding: 1rem; background: var(--bg-surface); border-radius: var(--radius);
  border: 1px solid var(--border); margin-bottom: 1rem;
}

/* Settings */
.mine-settings-toggle {
  display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;
}
.mine-checkbox {
  display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
}
.mine-checkbox input { accent-color: var(--primary); }
.mine-advanced {
  margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);
}

/* Signed grid */
.mine-signed-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.75rem;
}
.mine-signed-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1rem;
  transition: border-color 0.2s;
}
.mine-signed-card:hover { border-color: var(--border-bright); }

/* Explainer steps */
.mine-explainer {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 2rem;
}
.mine-steps {
  display: flex; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;
  justify-content: center;
}
.mine-step-card {
  flex: 1; min-width: 140px; max-width: 200px; text-align: center;
}
.mine-step-num {
  width: 36px; height: 36px; border-radius: 50%; margin: 0 auto 0.75rem;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-family: var(--mono);
  background: var(--primary-glow); border: 2px solid var(--primary); color: var(--primary);
}
.mine-step-card h3 { font-size: 0.95rem; margin-bottom: 0.35rem; }
.mine-step-arrow {
  color: var(--text-dim); font-size: 1.5rem; margin-top: 1rem;
}

@media (max-width: 640px) {
  .mine-steps { flex-direction: column; align-items: center; }
  .mine-step-arrow { transform: rotate(90deg); }
  .mine-step-card { max-width: 100%; }
  .mine-signed-grid { grid-template-columns: 1fr; }
}
`;
