import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_BODY_LENGTH } from "@biocrypt/core";
import { useStore } from "../store";
import { api } from "../api";
import { ProteinBar } from "../ProteinBar";

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

  const [difficulty, setDifficulty] = useState("00000");
  const [target, setTarget] = useState("00000" + "f".repeat(59));
  const [bodyLength, setBodyLength] = useState(DEFAULT_BODY_LENGTH);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<{
    totalSubmissions: number;
    epochProgress: string;
    nextAdjustmentIn: number;
    networkId: string;
    currentReward?: number;
    halvingEra?: number;
    halvingEraName?: string;
  } | null>(null);
  const [miningTime, setMiningTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  const submitQueueRef = useRef<{ coinGene: string; serial: string; serialHash: string; nonce: number; hash: string; difficulty: string; bonusCoinGenes?: Array<{ coinGene: string; merkleProof: Array<{ hash: string; position: "left" | "right" }> }> }[]>([]);

  const signedCoins = useMemo(() => coins.filter((c) => c.signed), [coins]);
  const unsignedCoins = useMemo(() => coins.filter((c) => !c.signed), [coins]);

  useEffect(() => {
    api.getDifficulty().then((d: any) => {
      setDifficulty(d.difficulty);
      setTarget(d.target);
      setNetworkInfo({
        totalSubmissions: d.totalSubmissions,
        epochProgress: d.epochProgress,
        nextAdjustmentIn: d.nextAdjustmentIn,
        networkId: d.networkId,
        currentReward: d.currentReward,
        halvingEra: d.halvingEra,
        halvingEraName: d.halvingEraName,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (mining.active) {
      timerRef.current = setInterval(() => setMiningTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setMiningTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mining.active]);

  const refreshDifficulty = useCallback(async (): Promise<{ difficulty: string; target: string } | null> => {
    const d: any = await api.getDifficulty().catch(() => null as null);
    if (d) {
      setDifficulty(d.difficulty);
      setTarget(d.target);
      setNetworkInfo({
        totalSubmissions: d.totalSubmissions,
        epochProgress: d.epochProgress,
        nextAdjustmentIn: d.nextAdjustmentIn,
        networkId: d.networkId,
        currentReward: d.currentReward,
        halvingEra: d.halvingEra,
        halvingEraName: d.halvingEraName,
      });
      workerRef.current?.postMessage({
        type: "updateTarget",
        target: d.target,
        difficulty: d.difficulty,
        blockReward: d.currentReward ?? 1,
      });
      return { difficulty: d.difficulty, target: d.target };
    }
    return null;
  }, []);

  const startMining = useCallback(async () => {
    if (!wallet) {
      addToast("error", "Create a wallet first.");
      return;
    }
    if (workerRef.current) workerRef.current.terminate();

    await refreshDifficulty();

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
          signed: false,
          bonusCoinGenes: msg.bonusCoinGenes,
        };
        addCoin(coin);
        const bonusLabel = msg.bonusCoinGenes?.length ? ` (+${msg.bonusCoinGenes.length} bonus)` : "";
        addToast("success", `Coin mined${bonusLabel}! Serial: ${msg.serialHash.slice(0, 12)}...`);

        if (autoSubmit) {
          submitCoin(coin);
        }
      }
    };

    worker.postMessage({ type: "start", target, difficulty, bodyLength, blockReward: networkInfo?.currentReward ?? 1 });
    workerRef.current = worker;
    setMining({ active: true, hashrate: 0, currentNonce: 0 });
  }, [wallet, difficulty, target, bodyLength, autoSubmit]);

  const stopMining = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "stop" });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setMining({ active: false, hashrate: 0 });
  }, []);

  useEffect(() => {
    return () => { workerRef.current?.terminate(); };
  }, []);

  const processQueue = useCallback(async () => {
    if (submittingRef.current) return;
    const coin = submitQueueRef.current.shift();
    if (!coin) return;

    submittingRef.current = true;
    setSubmitting(coin.serialHash);
    try {
      const result = await api.submitCoin(coin);
      updateCoin(coin.serialHash, {
        signed: true,
        networkSignature: result.coin.networkSignature,
        networkId: result.coin.networkId,
        networkGenome: result.coin.networkGenome,
        rflpFingerprint: result.coin.rflpFingerprint,
      });
      integrateCoin(coin.coinGene);

      const bonusCount = result.bonusCoins?.length || 0;
      if (bonusCount > 0) {
        for (const bonus of result.bonusCoins) {
          addCoin({
            coinGene: bonus.coinGene || "",
            serial: bonus.serial,
            serialHash: bonus.serialHash,
            aminoAcids: bonus.aminoAcids || [],
            nonce: bonus.nonce || 0,
            hash: bonus.hash || "",
            difficulty: bonus.difficulty || result.currentDifficulty,
            minedAt: Date.now(),
            signed: true,
            networkSignature: bonus.networkSignature,
            networkId: bonus.networkId,
            networkGenome: bonus.networkGenome,
            rflpFingerprint: bonus.rflpFingerprint,
          });
          if (bonus.coinGene) {
            integrateCoin(bonus.coinGene);
          }
        }
        addToast("success", `Block reward: ${result.blockReward} coins (1 mined + ${bonusCount} bonus) — Era: ${result.halvingEraName}`);
      } else {
        addToast("success", `Coin signed & mutated into your DNA`);
      }

      if (result.difficultyAdjusted) {
        addToast("info", `Difficulty adjusted to ${result.currentDifficulty.length} leading zeros`);
      }
      await refreshDifficulty();
    } catch (err: any) {
      const msg: string = err.message || "";
      if (msg.includes("proof-of-work") || msg.includes("Invalid") || msg.includes("Too many")) {
        const fresh = await refreshDifficulty();
        removeCoin(coin.serialHash);
        const staleCount = submitQueueRef.current.length;
        if (staleCount > 0) {
          submitQueueRef.current.forEach((c) => removeCoin(c.serialHash));
          submitQueueRef.current = [];
        }
        const zeros = fresh ? fresh.difficulty.length : "?";
        addToast("info", `Difficulty now ${zeros} zeros — ${staleCount + 1} stale coin(s) discarded. Mining continues.`);
      } else {
        addToast("error", `Signing failed: ${msg}`);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(null);
      if (submitQueueRef.current.length > 0) {
        processQueue();
      }
    }
  }, [updateCoin, integrateCoin, addToast, removeCoin, refreshDifficulty]);

  const submitCoin = useCallback((coin: { coinGene: string; serial: string; serialHash: string; nonce: number; hash: string; difficulty: string }) => {
    submitQueueRef.current.push(coin);
    processQueue();
  }, [processQueue]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const epochParts = networkInfo?.epochProgress?.split("/").map(Number) || [0, 10];
  const epochPct = epochParts[1] ? Math.round((epochParts[0] / epochParts[1]) * 100) : 0;

  return (
    <div className="page">
      <h1>Mine Coins</h1>
      <p className="text-muted mb-2" style={{ maxWidth: 600 }}>
        Use your browser's computing power to mine new BioCrypt coins. Each coin requires proof-of-work
        &mdash; finding a nonce that produces a hash below the network's difficulty target.
      </p>

      {!wallet ? (
        <div className="empty-state">
          <div className="empty-icon">{"\u26CF\uFE0F"}</div>
          <div className="empty-title">Wallet Required</div>
          <div className="empty-desc">You need a wallet to store mined coins. Create one to start mining.</div>
          <Link to="/wallet" className="btn btn-primary">Create Wallet</Link>
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
                      <div className="text-primary" style={{ fontWeight: 700, fontSize: "1.1rem" }}>Mining Active</div>
                      <div className="text-muted text-xs">{formatTime(miningTime)} elapsed</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>Ready to Mine</div>
                    <div className="text-muted text-xs">Click start to begin proof-of-work computation</div>
                  </div>
                )}
              </div>
              <div>
                {mining.active ? (
                  <button className="btn btn-danger" onClick={stopMining}>Stop Mining</button>
                ) : (
                  <button className="btn btn-primary btn-glow" onClick={startMining}>Start Mining</button>
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
                <div className="mine-stat-label">Mined This Session</div>
              </div>
              <div className="mine-stat">
                <div className="mine-stat-value">{signedCoins.length}</div>
                <div className="mine-stat-label">Total Signed</div>
              </div>
              <div className="mine-stat">
                <div className="mine-stat-value">{wallet.dna.length.toLocaleString()}</div>
                <div className="mine-stat-label">Wallet DNA (bases)</div>
              </div>
              {networkInfo?.currentReward && (
                <div className="mine-stat">
                  <div className="mine-stat-value">{networkInfo.currentReward}</div>
                  <div className="mine-stat-label">Block Reward</div>
                </div>
              )}
              {networkInfo?.halvingEraName && (
                <div className="mine-stat">
                  <div className="mine-stat-value">{networkInfo.halvingEraName}</div>
                  <div className="mine-stat-label">Era {(networkInfo.halvingEra ?? 0) + 1}</div>
                </div>
              )}
            </div>

            {/* Difficulty info */}
            <div className="mine-difficulty">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-muted">Network Difficulty</span>
                <span className="mono text-sm text-primary">{difficulty.length} leading zeros</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.min(100, difficulty.length * 12)}%` }} />
              </div>
              {networkInfo && (
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted">Epoch: {networkInfo.epochProgress} ({epochPct}%)</span>
                  <span className="text-xs text-muted">{networkInfo.nextAdjustmentIn} until adjustment</span>
                </div>
              )}
            </div>

            {/* Advanced settings toggle */}
            <div className="mine-settings-toggle">
              <button className="btn btn-sm btn-secondary" onClick={() => setShowSettings(!showSettings)}>
                {showSettings ? "Hide Settings" : "Advanced Settings"}
              </button>
              <label className="mine-checkbox">
                <input type="checkbox" checked={autoSubmit} onChange={(e) => setAutoSubmit(e.target.checked)} />
                <span className="text-sm">Auto-submit for signing</span>
              </label>
            </div>

            {showSettings && (
              <div className="mine-advanced">
                <div className="field">
                  <label className="label">Coin body length (codons)</label>
                  <input className="input input-mono" type="number" value={bodyLength}
                    onChange={(e) => setBodyLength(Number(e.target.value))}
                    disabled={mining.active} min={30} max={300} />
                  <span className="text-xs text-muted mt-05">Higher = more complex proteins, stronger security. Default: {DEFAULT_BODY_LENGTH}</span>
                </div>
                <div className="field">
                  <label className="label">Difficulty target (read-only)</label>
                  <div className="input input-mono" style={{ background: "var(--bg-card)", cursor: "default", opacity: 0.7, wordBreak: "break-all", fontSize: "0.7rem" }}>
                    {target}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Unsigned coins */}
          {unsignedCoins.length > 0 && (
            <div className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <h2 style={{ margin: 0 }}>Unsigned Coins ({unsignedCoins.length})</h2>
              </div>
              <p className="text-muted text-sm mb-2">
                These coins need to be signed by the network. Submit them to make them transferable.
              </p>
              {unsignedCoins.map((c) => (
                <div key={c.serialHash} className="card mb-1 flex justify-between items-center flex-wrap" style={{ gap: "0.75rem" }}>
                  <div className="flex items-center gap-1">
                    <span className="badge badge-warning">Unsigned</span>
                    {c.aminoAcids ? <ProteinBar aminoAcids={c.aminoAcids} height={10} maxWidth={140} /> : <span className="mono text-xs">{c.serialHash.slice(0, 20)}...</span>}
                  </div>
                  <button className="btn btn-primary btn-sm"
                    onClick={() => submitCoin(c)}
                    disabled={submitting === c.serialHash}>
                    {submitting === c.serialHash ? "Signing..." : "Submit to Network"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recent signed coins */}
          {signedCoins.length > 0 && (
            <div className="mt-3">
              <h2>Recently Signed ({signedCoins.length})</h2>
              <div className="mine-signed-grid">
                {signedCoins.slice(-8).reverse().map((c) => (
                  <div key={c.serialHash} className="mine-signed-card">
                    <div className="flex justify-between items-center">
                      <span className="badge badge-primary">Signed</span>
                      <span className="text-xs text-muted">{new Date(c.minedAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1">
                      {c.aminoAcids ? <ProteinBar aminoAcids={c.aminoAcids} height={10} /> : <div className="mono text-xs truncate">{c.serialHash}</div>}
                    </div>
                    <div className="flex gap-2 mt-1 text-xs text-muted">
                      <span>Nonce: {c.nonce.toLocaleString()}</span>
                      <span>Diff: {c.difficulty}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="mine-explainer mt-3">
            <h2>How Mining Works</h2>
            <div className="mine-steps">
              <div className="mine-step-card">
                <div className="mine-step-num">1</div>
                <h3>Generate</h3>
                <p className="text-muted text-sm">A random DNA coin gene is created in your browser with the coin protein header.</p>
              </div>
              <div className="mine-step-arrow">{"\u2192"}</div>
              <div className="mine-step-card">
                <div className="mine-step-num">2</div>
                <h3>Prove</h3>
                <p className="text-muted text-sm">Find a nonce where SHA-256(gene + nonce) has {difficulty.length}+ leading zeros.</p>
              </div>
              <div className="mine-step-arrow">{"\u2192"}</div>
              <div className="mine-step-card">
                <div className="mine-step-num">3</div>
                <h3>Sign</h3>
                <p className="text-muted text-sm">Submit to network. It signs with its DNA, making the coin officially valid.</p>
              </div>
              <div className="mine-step-arrow">{"\u2192"}</div>
              <div className="mine-step-card">
                <div className="mine-step-num">4</div>
                <h3>Own</h3>
                <p className="text-muted text-sm">The signed coin mutates into your wallet's DNA. It's yours to keep or transfer.</p>
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
