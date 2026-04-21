import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchDerivedStats, type DerivedNetworkStats } from "../networkStats";
import { DNAVisualization } from "../components/DNAVisualization";
import { ProteinBar } from "../ProteinBar";
import { trackerHttp, type TrackedMint } from "../trackerClient";
import { ribosome } from "@biocrypt/core";

type NetworkStats = DerivedNetworkStats;
type TabId = "overview" | "coins" | "proteins" | "dna";

interface DecodedMint extends TrackedMint {
  aminoAcids: string[];
  geneLength: number;
}

function decodeMint(mint: TrackedMint): DecodedMint {
  let aminoAcids: string[] = [];
  try {
    const rib = ribosome(mint.coin.coinGene);
    aminoAcids = rib.proteins[0]?.aminoAcids ?? [];
  } catch {
    aminoAcids = [];
  }
  return {
    ...mint,
    aminoAcids,
    geneLength: mint.coin.coinGene?.length ?? 0,
  };
}

export function Network() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [mints, setMints] = useState<DecodedMint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mintsLoading, setMintsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [expandedCoin, setExpandedCoin] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchDerivedStats()
      .then((s) => {
        if (s) { setStats(s); setError(""); }
        else setError("tracker unreachable");
      })
      .catch((e) => setError(e?.message || "tracker error"))
      .finally(() => setLoading(false));

    trackerHttp.latest()
      .then((list) => {
        setMints((list || []).map(decodeMint).reverse());
      })
      .catch(() => { /* leave previous mints in place */ })
      .finally(() => setMintsLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => { clearInterval(interval); };
  }, [load]);

  const coinCount = stats?.totalCoins ?? mints?.length ?? 0;

  return (
    <div className="page">
      <h1>Network Explorer</h1>
      <p className="text-muted mb-2" style={{ maxWidth: 760 }}>
        BioCrypt v1 is a decentralized mesh of trackers, miners, and wallets speaking the ZBIO protocol.
        No central signer, no blockchain &mdash; every coin is its own DNA gene, signed by the wallet that
        mined it and pinned to the frozen v1 genesis fingerprint. This page shows live state straight from
        the public tracker at <code className="mono">tracker.biocrypt.net</code>.
      </p>

      {loading && !stats && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem" }} />
          <p className="text-muted">Connecting to tracker...</p>
        </div>
      )}

      {error && !stats && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p className="text-muted mb-2">Could not reach the tracker.</p>
          <p className="text-xs text-muted">{error}</p>
          <button className="btn btn-secondary btn-sm mt-2" onClick={load}>Retry</button>
        </div>
      )}

      {stats && (
        <>
          <div className="net-hero">
            <HeroStat value={stats.totalCoins} label="Coins Minted" icon="coin" />
            <HeroStat value={stats.activeMiners} label="Active Miners" icon="mine" />
            <HeroStat value={stats.last24h} label="Minted (24h)" icon="mine" />
            <HeroStat value={`${stats.dnaLeadingTs} Ts`} label="PoW Difficulty" icon="difficulty" />
            <HeroStat value={stats.currentReward} label="Reward / coin" icon="shield" />
            <HeroStat value={stats.totalConnected} label="Live Connections" icon="wallet" />
            <HeroStat value={`${stats.telomerePercent.toFixed(1)}%`} label="Supply Remaining" icon="shield" />
          </div>

          <div className="net-tabs">
            <button className={`net-tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
              Overview
            </button>
            <button className={`net-tab ${activeTab === "coins" ? "active" : ""}`} onClick={() => setActiveTab("coins")}>
              Coins ({coinCount})
            </button>
            <button className={`net-tab ${activeTab === "proteins" ? "active" : ""}`} onClick={() => setActiveTab("proteins")}>
              Proteins ({mints?.length ?? "..."})
            </button>
            <button className={`net-tab ${activeTab === "dna" ? "active" : ""}`} onClick={() => setActiveTab("dna")}>
              Raw DNA
            </button>
          </div>

          {activeTab === "overview" && <OverviewTab stats={stats} mints={mints} />}
          {activeTab === "coins" && (
            <CoinsTab mints={mints} mintsLoading={mintsLoading} expandedCoin={expandedCoin} setExpandedCoin={setExpandedCoin} />
          )}
          {activeTab === "proteins" && <ProteinsTab mints={mints} mintsLoading={mintsLoading} />}
          {activeTab === "dna" && <DnaTab mints={mints} mintsLoading={mintsLoading} />}
        </>
      )}

      <style>{networkStyles}</style>
    </div>
  );
}

/* ─── Sub-Components ─── */

function HeroStat({ value, label, icon }: { value: string | number; label: string; icon: string }) {
  const icons: Record<string, string> = {
    coin: "\u{1FA99}",
    wallet: "\u{1F4B3}",
    mine: "\u26CF\uFE0F",
    difficulty: "\u{1F510}",
    shield: "\u{1F6E1}\uFE0F",
  };
  return (
    <div className="hero-stat">
      <div className="hero-icon">{icons[icon] || "\u2B50"}</div>
      <div className="hero-value">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="hero-label">{label}</div>
    </div>
  );
}

function OverviewTab({ stats, mints }: { stats: NetworkStats; mints: DecodedMint[] | null }) {
  const latestMint = mints && mints.length > 0 ? mints[0] : null;

  return (
    <div className="net-content">
      <div className="explainer-row">
        <div className="explainer-card">
          <div className="explainer-icon">{"\u{1F9EC}"}</div>
          <h3>Each coin is a gene</h3>
          <p>
            There is no single network DNA. Every coin carries its own ~200-base DNA strand (<code>coinGene</code>)
            produced by DNA256 proof-of-work. The gene is the coin&apos;s identity.
          </p>
        </div>
        <div className="explainer-card">
          <div className="explainer-icon">{"\u{1F52C}"}</div>
          <h3>Ribosome translation</h3>
          <p>
            Anyone can translate the <code>coinGene</code> with the same ribosome you&apos;d use on real mRNA &mdash;
            finding <code>ATG</code>, reading codons, stopping at <code>TAA</code>/<code>TAG</code>/<code>TGA</code>.
            The resulting amino-acid sequence is the coin&apos;s public serial.
          </p>
        </div>
        <div className="explainer-card">
          <div className="explainer-icon">{"\u{1F58A}\uFE0F"}</div>
          <h3>Miner-signed, genesis-locked</h3>
          <p>
            Every coin carries an Ed25519 signature from the miner wallet that minted it, plus the frozen v1
            genesis fingerprint. Offline verifiers can prove authenticity with <em>no</em> network access.
          </p>
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: "1.5rem" }}>
        <div className="card">
          <h2>Network Identity</h2>
          <div className="field">
            <label className="label">Network ID</label>
            <div className="mono text-sm">{stats.networkId}</div>
          </div>
          <div className="field">
            <label className="label">Genesis Genome Fingerprint</label>
            <div className="mono text-xs truncate">{stats.genomeFingerprint}</div>
          </div>
          <div className="field">
            <label className="label">Protocol Version</label>
            <div className="mono text-sm">v{stats.protocolVersion}</div>
          </div>
          <div className="field">
            <label className="label">Tracker ID</label>
            <div className="mono text-xs truncate">{stats.trackerId}</div>
          </div>
        </div>

        <div className="card">
          <h2>Mining &amp; Economics</h2>
          <div className="field">
            <label className="label">DNA256 PoW Target</label>
            <div className="mono text-sm">{stats.dnaLeadingTs} leading <code>T</code> bases (≈ {stats.difficulty.length} hex zeros)</div>
          </div>
          <div className="field">
            <label className="label">Current Reward</label>
            <div className="mono text-sm">{stats.currentReward} ZBIO per coin</div>
          </div>
          <div className="field">
            <label className="label">Coins Until Next Halving</label>
            <div className="mono text-sm">{stats.coinsUntilHalving.toLocaleString()}</div>
          </div>
          <div className="field">
            <label className="label">Circulating / Max</label>
            <div className="mono text-sm">{stats.circulatingSupply.toLocaleString()} / {stats.maxSupply.toLocaleString()}</div>
          </div>
          <div className="field">
            <label className="label">Live Connections</label>
            <div className="mono text-sm">
              {stats.activeMiners} miners &middot; {stats.activeWebClients} web clients &middot; {stats.peerTrackers} peer trackers
            </div>
          </div>
        </div>
      </div>

      {latestMint && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h2>Latest Coin</h2>
          <p className="text-muted text-sm mb-1">
            Coin <strong>#{latestMint.mintSeq}</strong> &mdash; {latestMint.geneLength} bases,
            {" "}{latestMint.coin.miningProof.leadingTs} leading Ts,
            {" "}received {formatRelative(latestMint.receivedAt)}.
          </p>
          <DNAVisualization dna={latestMint.coin.coinGene} maxLength={240} />
          {latestMint.aminoAcids.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <label className="label">Translated protein</label>
              <ProteinBar aminoAcids={latestMint.aminoAcids} height={12} />
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Network Health</h2>
        <div className="health-grid">
          <HealthIndicator
            label="Tracker Reachable"
            status={stats ? "healthy" : "degraded"}
            detail={stats ? "Online" : "Offline"}
          />
          <HealthIndicator
            label="Double-Spend Protection"
            status="healthy"
            detail={`${stats.nullifiers} nullifiers tracked`}
          />
          <HealthIndicator
            label="PoW Floor"
            status={stats.dnaLeadingTs >= 18 ? "healthy" : "warning"}
            detail={`${stats.dnaLeadingTs} leading Ts`}
          />
          <HealthIndicator
            label="Coins Minted"
            status={stats.totalCoins > 0 ? "healthy" : "neutral"}
            detail={`${stats.totalCoins.toLocaleString()} total`}
          />
        </div>
      </div>
    </div>
  );
}

function CoinsTab({ mints, mintsLoading, expandedCoin, setExpandedCoin }: {
  mints: DecodedMint[] | null;
  mintsLoading: boolean;
  expandedCoin: number | null;
  setExpandedCoin: (i: number | null) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredMints = useMemo(() => {
    if (!mints) return [];
    if (!search.trim()) return mints;
    const q = search.toLowerCase();
    return mints.filter((m) =>
      m.coin.serialHash.toLowerCase().includes(q) ||
      m.coin.serial.toLowerCase().includes(q) ||
      m.coin.minerPubKeyDNA.toLowerCase().includes(q) ||
      `#${m.mintSeq}`.includes(q)
    );
  }, [mints, search]);

  if (mintsLoading && !mints) {
    return (
      <div className="net-content">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem" }} />
          <p className="text-muted">Fetching latest mints from tracker...</p>
        </div>
      </div>
    );
  }

  if (!mints || mints.length === 0) {
    return (
      <div className="net-content">
        <div className="empty-state">
          <div className="empty-icon">{"\u{1FA99}"}</div>
          <div className="empty-title">No coins minted yet</div>
          <div className="empty-desc">The network is at genesis. Be the first miner to mint a v1 coin.</div>
          <Link to="/mine" className="btn btn-primary">Start Mining</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="net-content">
      <div className="flex justify-between items-center flex-wrap gap-1 mb-2">
        <p className="text-muted text-sm" style={{ margin: 0 }}>
          Showing the <strong>{mints.length} most recent mints</strong> from the tracker&apos;s rolling window.
          Click any row to inspect the full coin.
        </p>
        <input
          className="input input-mono"
          style={{ maxWidth: 280, padding: "0.45rem 0.75rem", fontSize: "0.8rem" }}
          placeholder="Search by serial, hash, miner..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {search && (
        <p className="text-xs text-muted mb-1">{filteredMints.length} of {mints.length} mints match</p>
      )}
      <div className="coin-list">
        {filteredMints.map((m) => {
          const isExpanded = expandedCoin === m.mintSeq;
          return (
            <div key={m.coin.serialHash} className={`coin-card ${isExpanded ? "expanded" : ""}`}>
              <div className="coin-header" onClick={() => setExpandedCoin(isExpanded ? null : m.mintSeq)}>
                <div className="coin-index">#{m.mintSeq}</div>
                <div className="coin-info">
                  <div className="mono text-xs truncate" style={{ maxWidth: 320 }}>{m.coin.serialHash}</div>
                  <div className="coin-meta text-xs text-muted mt-05">
                    {m.aminoAcids.length} acids &middot; {m.coin.miningProof.leadingTs} leading Ts &middot;
                    {" "}source: {m.source || "miner"} &middot; {formatRelative(m.receivedAt)}
                  </div>
                </div>
                <div className="coin-badge">ZBIO</div>
                <div className={`coin-chevron ${isExpanded ? "open" : ""}`}>{"\u25B6"}</div>
              </div>
              {isExpanded && (
                <div className="coin-details">
                  <div className="field">
                    <label className="label">Serial Hash</label>
                    <div className="mono text-xs" style={{ wordBreak: "break-all" }}>{m.coin.serialHash}</div>
                  </div>
                  <div className="field">
                    <label className="label">Miner Public Key (DNA)</label>
                    <div className="mono text-xs" style={{ wordBreak: "break-all" }}>{m.coin.minerPubKeyDNA}</div>
                  </div>
                  <div className="field">
                    <label className="label">Coin Gene ({m.geneLength} bases)</label>
                    <DNAVisualization dna={m.coin.coinGene} maxLength={240} />
                  </div>
                  {m.aminoAcids.length > 0 && (
                    <div className="field">
                      <label className="label">Translated Protein ({m.aminoAcids.length} acids)</label>
                      <ProteinBar aminoAcids={m.aminoAcids} height={12} />
                    </div>
                  )}
                  <div className="field">
                    <label className="label">Mining Proof</label>
                    <div className="mono text-xs">
                      nonce: {m.coin.miningProof.nonce.toLocaleString()} &middot;
                      {" "}leadingTs: {m.coin.miningProof.leadingTs} &middot;
                      {" "}minedAt: {new Date(m.coin.minedAt).toISOString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProteinsTab({ mints, mintsLoading }: { mints: DecodedMint[] | null; mintsLoading: boolean }) {
  if (mintsLoading && !mints) {
    return (
      <div className="net-content">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem" }} />
          <p className="text-muted">Running protein synthesis...</p>
        </div>
      </div>
    );
  }

  if (!mints || mints.length === 0) {
    return (
      <div className="net-content">
        <div className="empty-state">
          <div className="empty-icon">{"\u{1F52C}"}</div>
          <div className="empty-title">No proteins yet</div>
          <div className="empty-desc">Once coins are minted, the ribosome can translate each coin gene into its protein serial.</div>
          <Link to="/mine" className="btn btn-primary">Start Mining</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="net-content">
      <p className="text-muted text-sm mb-2">
        Every coin is its own protein. The ribosome reads each <code>coinGene</code> left-to-right, finds
        <code>ATG</code>, translates 3-base codons into amino acids, and stops at the first stop codon.
        The result &mdash; shown below &mdash; is the coin&apos;s public serial.
      </p>
      <div className="protein-table-wrap">
        <table className="protein-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Acids</th>
              <th>Leading Ts</th>
              <th>Gene Len</th>
              <th>Sequence</th>
            </tr>
          </thead>
          <tbody>
            {mints.map((m) => (
              <tr key={m.coin.serialHash} className="row-coin">
                <td className="mono">{m.mintSeq}</td>
                <td className="mono">{m.aminoAcids.length}</td>
                <td className="mono">{m.coin.miningProof.leadingTs}</td>
                <td className="mono">{m.geneLength}</td>
                <td style={{ maxWidth: 360 }}>
                  <ProteinBar aminoAcids={m.aminoAcids} height={10} maxWidth={360} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DnaTab({ mints, mintsLoading }: { mints: DecodedMint[] | null; mintsLoading: boolean }) {
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);

  if (mintsLoading && !mints) {
    return (
      <div className="net-content">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem" }} />
          <p className="text-muted">Loading coin genes...</p>
        </div>
      </div>
    );
  }

  if (!mints || mints.length === 0) {
    return (
      <div className="net-content">
        <div className="empty-state">
          <div className="empty-icon">{"\u{1F9EC}"}</div>
          <div className="empty-title">No coin genes to show</div>
          <div className="empty-desc">Each minted coin contributes its own DNA strand. None have been mined yet.</div>
          <Link to="/mine" className="btn btn-primary">Start Mining</Link>
        </div>
      </div>
    );
  }

  const current = selectedSeq !== null ? mints.find((m) => m.mintSeq === selectedSeq) : mints[0];

  return (
    <div className="net-content">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2>Coin Gene Inspector</h2>
            <p className="text-muted text-sm">
              In v1 there is no global network DNA. Each coin is its own mini-strand, typically {" "}
              {mints[0]?.geneLength ?? "~200"} bases. Select a mint to inspect its raw gene.
            </p>
          </div>
          <select
            className="input input-mono"
            style={{ padding: "0.45rem 0.75rem", fontSize: "0.8rem", maxWidth: 220 }}
            value={current?.mintSeq ?? ""}
            onChange={(e) => setSelectedSeq(Number(e.target.value))}
          >
            {mints.map((m) => (
              <option key={m.coin.serialHash} value={m.mintSeq}>
                #{m.mintSeq} &mdash; {m.coin.miningProof.leadingTs} Ts
              </option>
            ))}
          </select>
        </div>
        {current && (
          <div style={{ marginTop: "1rem" }}>
            <DNAVisualization dna={current.coin.coinGene} maxLength={current.geneLength} />
            <div className="field" style={{ marginTop: "1rem" }}>
              <label className="label">Raw gene</label>
              <div className="mono text-xs" style={{ wordBreak: "break-all", background: "var(--bg-surface)", padding: "0.75rem", borderRadius: "var(--radius)" }}>
                {current.coin.coinGene}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Reading Guide</h2>
        <div className="reading-guide">
          <div className="guide-item">
            <span className="base-A" style={{ fontSize: "1.5rem", fontWeight: 700 }}>A</span>
            <div>
              <strong>Adenine</strong>
              <p className="text-muted text-xs">Pairs with Thymine. One of the four DNA nucleotides.</p>
            </div>
          </div>
          <div className="guide-item">
            <span className="base-T" style={{ fontSize: "1.5rem", fontWeight: 700 }}>T</span>
            <div>
              <strong>Thymine</strong>
              <p className="text-muted text-xs">Pairs with Adenine. The leading-T run is what proof-of-work targets.</p>
            </div>
          </div>
          <div className="guide-item">
            <span className="base-G" style={{ fontSize: "1.5rem", fontWeight: 700 }}>G</span>
            <div>
              <strong>Guanine</strong>
              <p className="text-muted text-xs">Pairs with Cytosine. Triple hydrogen bond.</p>
            </div>
          </div>
          <div className="guide-item">
            <span className="base-C" style={{ fontSize: "1.5rem", fontWeight: 700 }}>C</span>
            <div>
              <strong>Cytosine</strong>
              <p className="text-muted text-xs">Pairs with Guanine. Essential for protein coding.</p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <h3 className="text-sm mb-1">How a coin gene is verified</h3>
          <ol className="text-sm text-muted" style={{ paddingLeft: "1.2rem", lineHeight: 2 }}>
            <li>Recompute <code>DNA256(coinGene, nonce)</code> &mdash; the result must begin with at least {mints[0]?.coin.miningProof.leadingTs ?? 18} leading <code>T</code> bases.</li>
            <li>Run the ribosome on <code>coinGene</code>. The amino-acid sequence after the header must equal the coin&apos;s declared <code>serial</code>.</li>
            <li>Check that <code>sha256(serial) === serialHash</code>.</li>
            <li>Verify the miner&apos;s Ed25519 signature against the canonical message <code>serialHash | genomeFingerprint | minerPubKeyDNA</code>.</li>
            <li>Check the genome fingerprint equals the frozen v1 constant.</li>
          </ol>
          <p className="text-xs text-muted" style={{ marginTop: "0.5rem" }}>
            All five steps run <strong>without any network access</strong> &mdash; verification is fully offline.
          </p>
        </div>
      </div>
    </div>
  );
}

function HealthIndicator({ label, status, detail }: { label: string; status: "healthy" | "warning" | "degraded" | "neutral"; detail: string }) {
  const colors = { healthy: "var(--success)", warning: "var(--warning)", degraded: "var(--danger)", neutral: "var(--text-muted)" };
  const icons = { healthy: "\u{1F7E2}", warning: "\u{1F7E1}", degraded: "\u{1F534}", neutral: "\u26AA" };
  return (
    <div className="health-item">
      <span style={{ fontSize: "1rem" }}>{icons[status]}</span>
      <div>
        <div className="text-sm" style={{ fontWeight: 600 }}>{label}</div>
        <div className="text-xs" style={{ color: colors[status] }}>{detail}</div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function formatRelative(ts: number | undefined): string {
  if (!ts) return "unknown";
  const delta = Date.now() - ts;
  if (delta < 0) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

/* ─── Styles ─── */

const networkStyles = `
.net-hero { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.hero-stat {
  flex: 1; min-width: 140px; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem 1rem; text-align: center;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.hero-stat:hover { border-color: var(--primary); box-shadow: 0 0 20px var(--primary-glow); }
.hero-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
.hero-value {
  font-family: var(--mono); font-size: 1.5rem; font-weight: 700;
  color: var(--primary); line-height: 1.2;
}
.hero-label {
  font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;
  text-transform: uppercase; letter-spacing: 0.05em;
}

.net-tabs {
  display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;
}
.net-tab {
  background: none; border: none; color: var(--text-muted); font-size: 0.9rem;
  padding: 0.75rem 1.25rem; cursor: pointer; position: relative; font-family: var(--font);
  transition: color 0.2s;
}
.net-tab:hover { color: var(--text); }
.net-tab.active { color: var(--primary); font-weight: 600; }
.net-tab.active::after {
  content: ""; position: absolute; bottom: -1px; left: 0; right: 0;
  height: 2px; background: var(--primary); border-radius: 1px 1px 0 0;
}

.net-content { animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.explainer-row {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;
}
.explainer-card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1.5rem; transition: border-color 0.2s;
}
.explainer-card:hover { border-color: var(--border-bright); }
.explainer-icon { font-size: 2rem; margin-bottom: 0.75rem; }
.explainer-card h3 { font-size: 1rem; margin-bottom: 0.5rem; color: var(--text); }
.explainer-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; }
.explainer-card code {
  background: rgba(0,229,153,0.1); color: var(--primary); padding: 0.1em 0.3em;
  border-radius: 3px; font-size: 0.8rem;
}

.coin-list { display: flex; flex-direction: column; gap: 0.5rem; }
.coin-card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; transition: border-color 0.2s;
}
.coin-card:hover { border-color: var(--border-bright); }
.coin-card.expanded { border-color: var(--primary); }
.coin-header {
  display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem;
  cursor: pointer; user-select: none;
}
.coin-index {
  font-family: var(--mono); font-weight: 700; font-size: 1rem; color: var(--primary);
  min-width: 36px;
}
.coin-info { flex: 1; min-width: 0; }
.coin-meta { margin-top: 0.15rem; }
.coin-badge {
  background: rgba(0,229,153,0.12); color: var(--primary); font-family: var(--mono);
  font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 12px;
  letter-spacing: 0.05em;
}
.coin-chevron { color: var(--text-muted); font-size: 0.7rem; transition: transform 0.2s; }
.coin-chevron.open { transform: rotate(90deg); }
.coin-details {
  padding: 0 1.25rem 1.25rem; border-top: 1px solid var(--border);
  animation: fadeIn 0.15s ease;
}

.protein-table-wrap { overflow-x: auto; }
.protein-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.protein-table th {
  text-align: left; padding: 0.75rem 1rem; border-bottom: 2px solid var(--border);
  color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
}
.protein-table td { padding: 0.6rem 1rem; border-bottom: 1px solid var(--border); }
.protein-table tbody tr:hover { background: var(--bg-card-hover); }
.row-coin td:first-child { border-left: 3px solid var(--primary); }

.reading-guide {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;
}
.guide-item { display: flex; gap: 0.75rem; align-items: flex-start; }
.guide-item strong { font-size: 0.85rem; }

.health-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;
}
.health-item {
  display: flex; gap: 0.75rem; align-items: center;
  padding: 0.75rem; background: var(--bg-surface); border-radius: var(--radius);
  border: 1px solid var(--border);
}

@media (max-width: 640px) {
  .net-hero { gap: 0.5rem; }
  .hero-stat { min-width: 100px; padding: 0.75rem 0.5rem; }
  .hero-value { font-size: 1.1rem; }
  .net-tabs { overflow-x: auto; }
  .net-tab { padding: 0.6rem 0.75rem; font-size: 0.8rem; white-space: nowrap; }
  .explainer-row { grid-template-columns: 1fr; }
  .coin-header { padding: 0.75rem; gap: 0.5rem; }
  .protein-table { font-size: 0.75rem; }
  .protein-table th, .protein-table td { padding: 0.5rem 0.5rem; }
}
`;
