import { useEffect, useState } from "react";
import { api, type NetworkStats } from "../api";
import { DNAVisualization } from "../components/DNAVisualization";

export function Network() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.getNetworkStats()
      .then((s) => { setStats(s); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page">
      <h1>Network</h1>

      {loading && !stats && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem" }} />
          <p className="text-muted">Connecting to network...</p>
        </div>
      )}

      {error && !stats && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p className="text-muted mb-2">Could not connect to the network.</p>
          <p className="text-xs text-muted">{error}</p>
          <button className="btn btn-secondary btn-sm mt-2" onClick={load}>Retry</button>
        </div>
      )}

      {stats && (
        <>
          <div className="card mb-2">
            <div className="stats-row">
              <div className="stat">
                <div className="stat-value mono">{stats.difficulty.length} zeros</div>
                <div className="stat-label">Difficulty</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.totalCoins}</div>
                <div className="stat-label">Total Coins</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.totalSubmissions}</div>
                <div className="stat-label">Submissions</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.totalWallets}</div>
                <div className="stat-label">Wallets</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.epochProgress}</div>
                <div className="stat-label">Epoch</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.nextAdjustmentIn}</div>
                <div className="stat-label">Next Adjust</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.peers}</div>
                <div className="stat-label">Peers</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.nullifiers}</div>
                <div className="stat-label">Nullifiers</div>
              </div>
            </div>
          </div>

          <div className="card-grid">
            <div className="card">
              <h2>Network Identity</h2>
              <div className="field">
                <label className="label">Network ID</label>
                <div className="mono text-sm">{stats.networkId}</div>
              </div>
              <div className="field">
                <label className="label">DNA Hash</label>
                <div className="mono text-xs truncate">{stats.dnaHash}</div>
              </div>
              <div className="field">
                <label className="label">DNA Length</label>
                <div className="mono text-sm">{stats.dnaLength.toLocaleString()} bases</div>
              </div>
            </div>

            <div className="card">
              <h2>How Mining Works</h2>
              <ol className="text-sm text-muted" style={{ paddingLeft: "1.2rem", lineHeight: 2 }}>
                <li>Your browser generates a random coin gene</li>
                <li>Proof-of-work: find nonce where SHA-256 &le; target ({stats.difficulty.length} leading zeros)</li>
                <li>Submit the mined coin to the network</li>
                <li>Network signs it with its DNA</li>
                <li>Signed coin is yours to keep, trade, or spend</li>
              </ol>
            </div>
          </div>
        </>
      )}

      <style>{networkStyles}</style>
    </div>
  );
}

const networkStyles = `
.stats-row {
  display: flex; justify-content: space-around; flex-wrap: wrap; gap: 1.5rem;
  padding: 1rem 0;
}
`;
