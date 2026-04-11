import { useRef, useState, useCallback, useEffect } from "react";
import { useStore } from "../store";
import { api } from "../api";

export function Mine() {
  const wallet = useStore((s) => s.wallet);
  const mining = useStore((s) => s.mining);
  const coins = useStore((s) => s.coins);
  const setMining = useStore((s) => s.setMining);
  const addCoin = useStore((s) => s.addCoin);
  const updateCoin = useStore((s) => s.updateCoin);
  const addToast = useStore((s) => s.addToast);

  const [difficulty, setDifficulty] = useState("00000");
  const [target, setTarget] = useState("00000" + "f".repeat(59));
  const [bodyLength, setBodyLength] = useState(60);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<{
    totalSubmissions: number;
    epochProgress: string;
    nextAdjustmentIn: number;
    networkId: string;
  } | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    api.getDifficulty().then((d) => {
      setDifficulty(d.difficulty);
      setTarget(d.target);
      setNetworkInfo({
        totalSubmissions: d.totalSubmissions,
        epochProgress: d.epochProgress,
        nextAdjustmentIn: d.nextAdjustmentIn,
        networkId: d.networkId,
      });
    }).catch(() => {});
  }, []);

  const refreshDifficulty = useCallback(async () => {
    try {
      const d = await api.getDifficulty();
      setDifficulty(d.difficulty);
      setTarget(d.target);
      setNetworkInfo({
        totalSubmissions: d.totalSubmissions,
        epochProgress: d.epochProgress,
        nextAdjustmentIn: d.nextAdjustmentIn,
        networkId: d.networkId,
      });
    } catch {}
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
          nonce: msg.nonce,
          hash: msg.hash,
          difficulty: msg.difficulty,
          minedAt: msg.minedAt,
          signed: false,
        };
        addCoin(coin);
        addToast("success", `Coin mined! Serial: ${msg.serialHash.slice(0, 12)}...`);

        if (autoSubmit) {
          submitCoin(coin);
        }
      }
    };

    worker.postMessage({ type: "start", target, difficulty, bodyLength });
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

  const submitCoin = async (coin: { coinGene: string; serial: string; serialHash: string; nonce: number; hash: string; difficulty: string }) => {
    setSubmitting(coin.serialHash);
    try {
      const result = await api.submitCoin(coin);
      updateCoin(coin.serialHash, {
        signed: true,
        networkSignature: result.coin.networkSignature,
        networkId: result.coin.networkId,
      });
      addToast("success", `Coin signed by network: ${result.coin.networkId}`);

      if (result.difficultyAdjusted) {
        setDifficulty(result.currentDifficulty);
        setTarget(result.currentTarget);
        addToast("info", `Difficulty adjusted to ${result.currentDifficulty.length} leading zeros`);
      }

      const d = await api.getDifficulty().catch(() => null);
      if (d) {
        setDifficulty(d.difficulty);
        setTarget(d.target);
        setNetworkInfo({
          totalSubmissions: d.totalSubmissions,
          epochProgress: d.epochProgress,
          nextAdjustmentIn: d.nextAdjustmentIn,
          networkId: d.networkId,
        });
        workerRef.current?.postMessage({
          type: "updateTarget",
          target: d.target,
          difficulty: d.difficulty,
        });
      }
    } catch (err: any) {
      addToast("error", `Signing failed: ${err.message}`);
    } finally {
      setSubmitting(null);
    }
  };

  const unsignedCoins = coins.filter((c) => !c.signed);
  const signedCoins = coins.filter((c) => c.signed);

  return (
    <div className="page">
      <h1>Mine Coins</h1>

      <div className="card-grid">
        <div className="card">
          <h2>Mining Controls</h2>

          <div className="field">
            <label className="label">Network Difficulty</label>
            <div className="input input-mono" style={{ background: "var(--bg-card)", cursor: "default", opacity: 0.9 }}>
              {difficulty.length} leading zeros — <span className="text-xs text-muted">prefix: {difficulty}</span>
            </div>
            <div className="text-xs text-muted" style={{ marginTop: "0.25rem" }}>
              Adjusts automatically every {networkInfo?.epochProgress?.split("/")[1] || 10} submissions (Bitcoin-style)
            </div>
          </div>

          {networkInfo && (
            <div className="flex gap-3 mb-2" style={{ flexWrap: "wrap" }}>
              <div className="stat">
                <div className="stat-value mono">{networkInfo.epochProgress}</div>
                <div className="stat-label">Epoch Progress</div>
              </div>
              <div className="stat">
                <div className="stat-value">{networkInfo.nextAdjustmentIn}</div>
                <div className="stat-label">Until Adjustment</div>
              </div>
              <div className="stat">
                <div className="stat-value">{networkInfo.totalSubmissions}</div>
                <div className="stat-label">Total Submissions</div>
              </div>
            </div>
          )}

          <div className="field">
            <label className="label">Coin body length (codons)</label>
            <input className="input input-mono" type="number" value={bodyLength}
              onChange={(e) => setBodyLength(Number(e.target.value))}
              disabled={mining.active} min={30} max={300} />
          </div>
          <div className="field">
            <label className="flex items-center gap-1" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={autoSubmit}
                onChange={(e) => setAutoSubmit(e.target.checked)} />
              <span className="text-sm">Auto-submit to network for signing</span>
            </label>
          </div>
          {mining.active ? (
            <button className="btn btn-danger" onClick={stopMining}>Stop Mining</button>
          ) : (
            <button className="btn btn-primary" onClick={startMining} disabled={!wallet}>
              {wallet ? "Start Mining" : "Create wallet first"}
            </button>
          )}
        </div>

        <div className="card">
          <h2>Mining Status</h2>
          <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
            <div className="stat">
              <div className="stat-value">
                {mining.active ? (
                  <span className="flex items-center gap-1">
                    <span className="spinner" /> Active
                  </span>
                ) : "Idle"}
              </div>
              <div className="stat-label">Status</div>
            </div>
            <div className="stat">
              <div className="stat-value">{formatHashrate(mining.hashrate)}</div>
              <div className="stat-label">Hashrate</div>
            </div>
            <div className="stat">
              <div className="stat-value">{mining.totalMined}</div>
              <div className="stat-label">Total Mined</div>
            </div>
          </div>
          {mining.active && (
            <div className="mt-2 text-sm text-muted mono">
              Nonce: {mining.currentNonce.toLocaleString()}
            </div>
          )}
          <div className="mt-2 text-xs text-muted mono" style={{ wordBreak: "break-all" }}>
            Target: {target.slice(0, 20)}...
          </div>
        </div>
      </div>

      {unsignedCoins.length > 0 && (
        <div className="mt-3">
          <h2>Unsigned Coins ({unsignedCoins.length})</h2>
          <p className="text-muted text-sm mb-2">
            These coins need to be signed by the network before they can be used.
          </p>
          {unsignedCoins.map((c) => (
            <div key={c.serialHash} className="card mb-2 flex justify-between items-center"
              style={{ flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <span className="badge badge-warning">Unsigned</span>
                <span className="mono text-xs" style={{ marginLeft: "0.5rem" }}>
                  {c.serialHash.slice(0, 20)}...
                </span>
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

      {signedCoins.length > 0 && (
        <div className="mt-3">
          <h2>Signed Coins ({signedCoins.length})</h2>
          <div className="card-grid">
            {signedCoins.slice(-10).reverse().map((c) => (
              <div key={c.serialHash} className="card">
                <div className="flex justify-between items-center">
                  <span className="badge badge-primary">Signed</span>
                  <span className="text-xs text-muted">
                    {new Date(c.minedAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 mono text-xs truncate">{c.serialHash}</div>
                <div className="mt-1 text-xs text-muted">
                  Nonce: {c.nonce.toLocaleString()} | Difficulty: {c.difficulty}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatHashrate(h: number): string {
  if (h === 0) return "0";
  if (h > 1_000_000) return `${(h / 1_000_000).toFixed(1)}M`;
  if (h > 1_000) return `${(h / 1_000).toFixed(1)}K`;
  return h.toString();
}
