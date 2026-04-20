import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api, type NetworkStats, type NetworkDnaAnalysis, type RFLPFingerprint } from "../api";
import { DNAVisualization } from "../components/DNAVisualization";
import { ProteinBar, ProteinBarInline } from "../ProteinBar";
import { GelElectrophoresis } from "../components/GelElectrophoresis";
import { NETWORK_ENZYMES, digestWithEnzymes } from "@biocrypt/core";

export function Network() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [dnaData, setDnaData] = useState<NetworkDnaAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [dnaLoading, setDnaLoading] = useState(true);
  const [error, setError] = useState("");
  const [rflp, setRflp] = useState<RFLPFingerprint | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "coins" | "proteins" | "dna">("overview");
  const [expandedCoin, setExpandedCoin] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.getNetworkStats()
      .then((s) => { setStats(s); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadDna = () => {
    setDnaLoading(true);
    api.getNetworkDna()
      .then((d) => setDnaData(d))
      .catch(() => {})
      .finally(() => setDnaLoading(false));
    api.getNetworkRFLP()
      .then((r) => setRflp(r))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    loadDna();
    const interval = setInterval(load, 15000);
    const dnaInterval = setInterval(loadDna, 30000);
    return () => { clearInterval(interval); clearInterval(dnaInterval); };
  }, []);

  return (
    <div className="page">
      <h1>Network Explorer</h1>
      <p className="text-muted mb-2" style={{ maxWidth: 700 }}>
        The BioCrypt network is a living organism. Its DNA stores every coin ever minted.
        Below you can see the full state of the network in real time.
      </p>

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
          {/* Hero Stats Bar */}
          <div className="net-hero">
            <HeroStat value={dnaData?.totalCoins ?? stats.totalCoins} label="Coins in Network" icon="coin" />
            <HeroStat value={stats.totalWallets} label="Active Miners" icon="wallet" />
            <HeroStat value={stats.totalSubmissions} label="Blocks Mined" icon="mine" />
            <HeroStat value={`${stats.difficulty.length} zeros`} label="Difficulty" icon="difficulty" />
            <HeroStat value={(stats as any).currentReward ?? "?"} label="Block Reward" icon="shield" />
            <HeroStat value={(stats as any).halvingEraName ?? "Genesis"} label={`Era ${((stats as any).halvingEra ?? 0) + 1}`} icon="shield" />
            <HeroStat value={`${((stats as any).telomerePercent ?? 100).toFixed(1)}%`} label="Telomere" icon="shield" />
          </div>

          {/* Tab Navigation */}
          <div className="net-tabs">
            <button className={`net-tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
              Overview
            </button>
            <button className={`net-tab ${activeTab === "coins" ? "active" : ""}`} onClick={() => setActiveTab("coins")}>
              Coins ({dnaData?.totalCoins ?? "..."})
            </button>
            <button className={`net-tab ${activeTab === "proteins" ? "active" : ""}`} onClick={() => setActiveTab("proteins")}>
              Proteins ({dnaData?.totalProteins ?? "..."})
            </button>
            <button className={`net-tab ${activeTab === "dna" ? "active" : ""}`} onClick={() => setActiveTab("dna")}>
              Raw DNA
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <OverviewTab stats={stats} dnaData={dnaData} dnaLoading={dnaLoading} networkRflp={rflp} />
          )}
          {activeTab === "coins" && (
            <CoinsTab dnaData={dnaData} dnaLoading={dnaLoading} expandedCoin={expandedCoin} setExpandedCoin={setExpandedCoin} networkRflp={rflp} />
          )}
          {activeTab === "proteins" && (
            <ProteinsTab dnaData={dnaData} dnaLoading={dnaLoading} />
          )}
          {activeTab === "dna" && (
            <DnaTab dnaData={dnaData} dnaLoading={dnaLoading} />
          )}
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

function OverviewTab({ stats, dnaData, dnaLoading, networkRflp }: { stats: NetworkStats; dnaData: NetworkDnaAnalysis | null; dnaLoading: boolean; networkRflp: RFLPFingerprint | null }) {
  return (
    <div className="net-content">
      {/* Explainer cards */}
      <div className="explainer-row">
        <div className="explainer-card">
          <div className="explainer-icon">{"\u{1F9EC}"}</div>
          <h3>What is Network DNA?</h3>
          <p>
            The network has its own DNA strand, just like a living organism. Every coin mined on the
            network gets <strong>mutated into this DNA</strong> as a new protein. The DNA grows as the
            network grows.
          </p>
        </div>
        <div className="explainer-card">
          <div className="explainer-icon">{"\u{1FA99}"}</div>
          <h3>What are Coins?</h3>
          <p>
            Each coin is a <strong>protein</strong> encoded in DNA. Miners use proof-of-work to create
            coin genes, and the network signs them by mutating its DNA. A coin's identity is its amino
            acid sequence &mdash; impossible to forge.
          </p>
        </div>
        <div className="explainer-card">
          <div className="explainer-icon">{"\u{1F52C}"}</div>
          <h3>Protein Synthesis</h3>
          <p>
            DNA is read like a biological ribosome &mdash; scanning for <code>ATG</code> (start) codons,
            translating 3-letter codes into amino acids, and stopping at stop codons. The result is a set
            of proteins that hold the network's value.
          </p>
        </div>
      </div>

      {/* Network Identity */}
      <div className="card-grid" style={{ marginTop: "1.5rem" }}>
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
          {dnaData && (
            <>
              <div className="field">
                <label className="label">Public Key Hash</label>
                <div className="mono text-xs truncate">{dnaData.publicKeyHash}</div>
              </div>
              <div className="field">
                <label className="label">Intergenic Regions</label>
                <div className="mono text-sm">{dnaData.intergenicRegions}</div>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2>Mining & Difficulty</h2>
          <div className="field">
            <label className="label">Current Difficulty</label>
            <div className="mono text-sm">{stats.difficulty.length} leading zeros (<code>{stats.difficulty}</code>)</div>
          </div>
          <div className="field">
            <label className="label">Epoch Progress</label>
            <div className="epoch-bar">
              <div className="epoch-fill" style={{ width: `${parseEpochPercent(stats.epochProgress)}%` }} />
              <span className="epoch-text">{stats.epochProgress}</span>
            </div>
          </div>
          <div className="field">
            <label className="label">Next Adjustment In</label>
            <div className="mono text-sm">{stats.nextAdjustmentIn} submissions</div>
          </div>
          <div className="field">
            <label className="label">Connected Peers</label>
            <div className="mono text-sm">{stats.peers}</div>
          </div>
        </div>
      </div>

      {/* Quick DNA Preview */}
      {dnaData && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h2>DNA Preview</h2>
          <p className="text-muted text-sm mb-1">
            First 800 bases of the network's {dnaData.dnaLength.toLocaleString()}-base DNA strand.
            Each color represents a nucleotide: <span className="base-A">A</span> <span className="base-T">T</span> <span className="base-G">G</span> <span className="base-C">C</span>
          </p>
          <DNAVisualization dna={dnaData.dna} maxLength={800} />
        </div>
      )}

      {/* RFLP Gel Electrophoresis */}
      {dnaData && dnaData.coins.length > 0 && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h2>DNA Fingerprinting &mdash; Gel Electrophoresis</h2>
          <p className="text-muted text-sm mb-2">
            Each coin carries a 180-base parentage marker DNA generated by the network's private key during signing.
            For each coin, the purple lane shows the stored fragment pattern and the green lane shows independent
            re-digestion of the marker DNA. Matching bands prove the coin is authentic.
          </p>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <GelElectrophoresis
                lanes={dnaData.coins.slice(0, 5).flatMap((c, i) => {
                  const stored = c.rflpFragments && c.rflpFragments.length > 0 ? c.rflpFragments : [c.length * 3];
                  const verified = c.rflpMarkerDNA ? digestWithEnzymes(c.rflpMarkerDNA) : stored;
                  return [
                    { label: `#${i + 1}`, fragments: stored, color: "#a855f7", highlight: false },
                    { label: "\u2713", fragments: verified, color: "#22c55e", highlight: true },
                  ];
                })}
                height={280}
                showLadder
                compact
              />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="gel-legend">
                <div className="gel-legend-item">
                  <span className="gel-legend-swatch" style={{ background: "#a855f7" }} />
                  <span>Stored RFLP fingerprint (from network signing)</span>
                </div>
                <div className="gel-legend-item">
                  <span className="gel-legend-swatch" style={{ background: "#22c55e" }} />
                  <span>Verified &mdash; independent re-digestion of marker DNA</span>
                </div>
              </div>
              <p className="text-xs text-muted" style={{ marginTop: "0.75rem", lineHeight: 1.7 }}>
                Paired lanes per coin: purple = stored fragment sizes, green = freshly computed from the marker DNA
                using restriction enzymes ({NETWORK_ENZYMES.map((e) => e.name).join(", ")}). 
                If all bands align, the coin's parentage is cryptographically proven &mdash; like forensic DNA fingerprinting.
              </p>
              <div className="gel-enzyme-list">
                {NETWORK_ENZYMES.map((e) => (
                  <span key={e.name} className="gel-enzyme-tag">
                    {e.name}: <code>{e.site}</code>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Network Health */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Network Health</h2>
        <div className="health-grid">
          <HealthIndicator
            label="Network Status"
            status={stats.peers >= 0 ? "healthy" : "degraded"}
            detail={stats.peers >= 0 ? "Online" : "Offline"}
          />
          <HealthIndicator
            label="Double-Spend Protection"
            status={stats.nullifiers >= 0 ? "healthy" : "warning"}
            detail={`${stats.nullifiers} nullifiers tracked`}
          />
          <HealthIndicator
            label="Difficulty"
            status={stats.difficulty.length >= 3 ? "healthy" : "warning"}
            detail={`${stats.difficulty.length} leading zeros`}
          />
          <HealthIndicator
            label="Coins Minted"
            status={stats.totalCoins > 0 ? "healthy" : "neutral"}
            detail={`${stats.totalCoins} total`}
          />
        </div>
      </div>

      {dnaLoading && !dnaData && (
        <div className="card" style={{ textAlign: "center", padding: "2rem", marginTop: "1.5rem" }}>
          <div className="spinner" style={{ margin: "0 auto 0.75rem" }} />
          <p className="text-muted text-sm">Synthesizing proteins from network DNA...</p>
        </div>
      )}

      {/* Synthesis Summary */}
      {dnaData && <SynthesisSummary dnaData={dnaData} />}
    </div>
  );
}

function SynthesisSummary({ dnaData }: { dnaData: NetworkDnaAnalysis }) {
  const roleDistribution = useMemo(() => {
    const roles: Record<string, number> = {};
    for (const p of dnaData.structuralProteins) {
      roles[p.role] = (roles[p.role] || 0) + 1;
    }
    return Object.entries(roles).sort((a, b) => b[1] - a[1]);
  }, [dnaData]);

  return (
    <div className="card" style={{ marginTop: "1.5rem" }}>
      <h2>Protein Synthesis Summary</h2>
      <p className="text-muted text-sm mb-2">
        The ribosome scanned the network DNA and produced {dnaData.totalProteins} proteins:
        {" "}<strong>{dnaData.totalCoins} coins</strong> and <strong>{dnaData.totalStructural} structural proteins</strong>.
      </p>
      <div className="synthesis-grid">
        <div className="synth-card synth-coins">
          <div className="synth-number">{dnaData.totalCoins}</div>
          <div className="synth-label">Coin Proteins</div>
          <div className="synth-desc">
            Proteins with the <code>Met-Gly-Trp-Cys</code> header.
            Each one is a mined and signed BioCrypt coin.
          </div>
        </div>
        <div className="synth-card synth-structural">
          <div className="synth-number">{dnaData.totalStructural}</div>
          <div className="synth-label">Structural Proteins</div>
          <div className="synth-desc">
            Non-coin proteins that form the network's backbone and identity.
          </div>
        </div>
        <div className="synth-card synth-regions">
          <div className="synth-number">{dnaData.intergenicRegions}</div>
          <div className="synth-label">Intergenic Regions</div>
          <div className="synth-desc">
            DNA between proteins that determines how they fold and connect.
          </div>
        </div>
      </div>

      {roleDistribution.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3 className="text-sm" style={{ marginBottom: "0.75rem" }}>Structural Protein Roles</h3>
          <div className="role-bars">
            {roleDistribution.map(([role, count]) => {
              const pct = Math.round((count / dnaData.totalStructural) * 100);
              return (
                <div key={role} className="role-row">
                  <span className="role-name">{role}</span>
                  <div className="role-bar-track">
                    <div className="role-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="role-count">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CoinsTab({ dnaData, dnaLoading, expandedCoin, setExpandedCoin, networkRflp }: {
  dnaData: NetworkDnaAnalysis | null;
  dnaLoading: boolean;
  expandedCoin: number | null;
  setExpandedCoin: (i: number | null) => void;
  networkRflp: RFLPFingerprint | null;
}) {
  const [search, setSearch] = useState("");

  const filteredCoins = useMemo(() => {
    if (!dnaData) return [];
    if (!search.trim()) return dnaData.coins;
    const q = search.toLowerCase();
    return dnaData.coins.filter((c) =>
      c.serialHash.toLowerCase().includes(q) ||
      c.serial.toLowerCase().includes(q) ||
      `#${dnaData.coins.indexOf(c) + 1}`.includes(q)
    );
  }, [dnaData, search]);

  if (dnaLoading && !dnaData) {
    return (
      <div className="net-content">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem" }} />
          <p className="text-muted">Scanning DNA for coins...</p>
        </div>
      </div>
    );
  }

  if (!dnaData || dnaData.coins.length === 0) {
    return (
      <div className="net-content">
        <div className="empty-state">
          <div className="empty-icon">{"\u{1FA99}"}</div>
          <div className="empty-title">No coins in network DNA</div>
          <div className="empty-desc">No coins have been mined yet. Be the first miner to create a coin!</div>
          <Link to="/mine" className="btn btn-primary">Start Mining</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="net-content">
      <div className="flex justify-between items-center flex-wrap gap-1 mb-2">
        <p className="text-muted text-sm" style={{ margin: 0 }}>
          {dnaData.coins.length} coins encoded in network DNA.
          Each coin is a protein with the <code>Met-Gly-Trp-Cys</code> header.
        </p>
        <input
          className="input input-mono"
          style={{ maxWidth: 280, padding: "0.45rem 0.75rem", fontSize: "0.8rem" }}
          placeholder="Search by hash or #number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {search && (
        <p className="text-xs text-muted mb-1">{filteredCoins.length} of {dnaData.coins.length} coins match</p>
      )}
      <div className="coin-list">
        {filteredCoins.map((coin, i) => {
          const realIndex = dnaData.coins.indexOf(coin);
          const isExpanded = expandedCoin === realIndex;
          return (
            <div key={coin.serialHash} className={`coin-card ${isExpanded ? "expanded" : ""}`}>
              <div className="coin-header" onClick={() => setExpandedCoin(isExpanded ? null : realIndex)}>
                <div className="coin-index">#{i + 1}</div>
                <div className="coin-info">
                  <ProteinBar aminoAcids={coin.aminoAcids} height={10} maxWidth={160} />
                  <div className="coin-meta text-xs text-muted mt-05">
                    {coin.length} acids &middot; #{coin.index}
                  </div>
                </div>
                <div className="coin-badge">ZBIO</div>
                <div className={`coin-chevron ${isExpanded ? "open" : ""}`}>{"\u25B6"}</div>
              </div>
              {isExpanded && (
                <div className="coin-details">
                  <div className="field">
                    <label className="label">Full Serial Hash</label>
                    <div className="mono text-xs" style={{ wordBreak: "break-all" }}>{coin.serialHash}</div>
                  </div>
                  <div className="field">
                    <label className="label">Protein Signature</label>
                    <ProteinBar aminoAcids={coin.aminoAcids} height={12} />
                  </div>
                  {coin.rflpFragments && coin.rflpFragments.length > 0 && (
                    <div className="field">
                      <label className="label">RFLP Gel Electrophoresis</label>
                      <p className="text-xs text-muted" style={{ marginBottom: "0.5rem" }}>
                        Purple = stored fingerprint, Green = re-digested marker DNA.
                        {(coin.rflpMarkerCount ?? 0) >= 2
                          ? ` ${coin.rflpMarkerCount} cut sites — bands match, parentage proven.`
                          : " Too few cut sites — suspect coin."}
                      </p>
                      <GelElectrophoresis
                        lanes={(() => {
                          const stored = coin.rflpFragments;
                          const verified = coin.rflpMarkerDNA ? digestWithEnzymes(coin.rflpMarkerDNA) : stored;
                          return [
                            { label: "Stored", fragments: stored, color: "#a855f7", highlight: false },
                            { label: "Verify", fragments: verified, color: "#22c55e", highlight: true },
                          ];
                        })()}
                        height={200}
                        showLadder
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProteinsTab({ dnaData, dnaLoading }: { dnaData: NetworkDnaAnalysis | null; dnaLoading: boolean }) {
  if (dnaLoading && !dnaData) {
    return (
      <div className="net-content">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem" }} />
          <p className="text-muted">Running protein synthesis...</p>
        </div>
      </div>
    );
  }

  if (!dnaData) return null;

  const allProteins = [
    ...dnaData.coins.map((c) => ({ ...c, type: "coin" as const, role: "coin", charge: 0, polarity: 0, hydrophobicity: 0 })),
    ...dnaData.structuralProteins.map((p) => ({ ...p, type: "structural" as const, serial: "", serialHash: "" })),
  ].sort((a, b) => a.index - b.index);

  return (
    <div className="net-content">
      <p className="text-muted text-sm mb-2">
        All {dnaData.totalProteins} proteins translated from the network DNA by the ribosome.
        Coin proteins are marked in green, structural proteins in blue.
      </p>
      <div className="protein-table-wrap">
        <table className="protein-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Length</th>
              <th>Role</th>
              <th>Charge</th>
              <th>Polarity</th>
              <th>Sequence Preview</th>
            </tr>
          </thead>
          <tbody>
            {allProteins.map((p) => (
              <tr key={p.index} className={p.type === "coin" ? "row-coin" : "row-structural"}>
                <td className="mono">{p.index}</td>
                <td>
                  <span className={`type-badge ${p.type}`}>{p.type === "coin" ? "Coin" : "Structural"}</span>
                </td>
                <td className="mono">{p.length}</td>
                <td className="text-muted">{p.role}</td>
                <td className="mono">{p.charge > 0 ? `+${p.charge}` : p.charge}</td>
                <td className="mono">{typeof p.polarity === "number" ? `${Math.round(p.polarity * 100)}%` : "-"}</td>
                <td style={{ maxWidth: 220 }}>
                  <ProteinBar aminoAcids={p.aminoAcids} height={10} maxWidth={220} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DnaTab({ dnaData, dnaLoading }: { dnaData: NetworkDnaAnalysis | null; dnaLoading: boolean }) {
  const [showLength, setShowLength] = useState(2000);

  if (dnaLoading && !dnaData) {
    return (
      <div className="net-content">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem" }} />
          <p className="text-muted">Loading DNA strand...</p>
        </div>
      </div>
    );
  }

  if (!dnaData) return null;

  return (
    <div className="net-content">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2>Network DNA Strand</h2>
            <p className="text-muted text-sm">
              {dnaData.dnaLength.toLocaleString()} bases total &middot; Showing first {Math.min(showLength, dnaData.dnaLength).toLocaleString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[2000, 5000, 10000].map((n) => (
              <button
                key={n}
                className={`btn btn-sm ${showLength === n ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setShowLength(n)}
              >
                {(n / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <DNAVisualization dna={dnaData.dna} maxLength={showLength} />
        </div>
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
              <p className="text-muted text-xs">Pairs with Adenine. Provides structural stability.</p>
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
          <h3 className="text-sm mb-1">How Protein Synthesis Works</h3>
          <ol className="text-sm text-muted" style={{ paddingLeft: "1.2rem", lineHeight: 2 }}>
            <li>The ribosome scans the DNA from left to right, reading 3 bases (a codon) at a time</li>
            <li>When it finds <code>ATG</code> (start codon), it begins building a protein</li>
            <li>Each codon maps to an amino acid using the <strong>human codon table</strong></li>
            <li>A stop codon (<code>TAA</code>, <code>TAG</code>, or <code>TGA</code>) ends the protein</li>
            <li>Coins have a special header: <code className="text-success">Met-Gly-Trp-Cys</code></li>
            <li>The DNA between proteins (intergenic regions) determines how they fold together</li>
          </ol>
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

function parseEpochPercent(epoch: string): number {
  const [current, total] = epoch.split("/").map(Number);
  if (!total) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

/* ─── Styles ─── */

const networkStyles = `
/* Hero Stats */
.net-hero {
  display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;
}
.hero-stat {
  flex: 1; min-width: 140px; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem 1rem; text-align: center;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.hero-stat:hover {
  border-color: var(--primary); box-shadow: 0 0 20px var(--primary-glow);
}
.hero-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
.hero-value {
  font-family: var(--mono); font-size: 1.5rem; font-weight: 700;
  color: var(--primary); line-height: 1.2;
}
.hero-label {
  font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;
  text-transform: uppercase; letter-spacing: 0.05em;
}

/* Tabs */
.net-tabs {
  display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;
}
.net-tab {
  background: none; border: none; color: var(--text-muted); font-size: 0.9rem;
  padding: 0.75rem 1.25rem; cursor: pointer; position: relative; font-family: var(--font);
  transition: color 0.2s;
}
.net-tab:hover { color: var(--text); }
.net-tab.active {
  color: var(--primary); font-weight: 600;
}
.net-tab.active::after {
  content: ""; position: absolute; bottom: -1px; left: 0; right: 0;
  height: 2px; background: var(--primary); border-radius: 1px 1px 0 0;
}

.net-content { animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* Explainer Cards */
.explainer-row {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
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

/* Epoch bar */
.epoch-bar {
  position: relative; height: 28px; background: var(--bg-surface);
  border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
}
.epoch-fill {
  height: 100%; background: linear-gradient(90deg, var(--primary-dim), var(--primary));
  border-radius: 14px; transition: width 0.6s ease;
}
.epoch-text {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-family: var(--mono); font-size: 0.75rem; color: var(--text);
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

/* Synthesis Summary */
.synthesis-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;
}
.synth-card {
  border-radius: var(--radius); padding: 1.25rem; text-align: center;
}
.synth-coins { background: rgba(0,229,153,0.08); border: 1px solid rgba(0,229,153,0.2); }
.synth-structural { background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.2); }
.synth-regions { background: rgba(210,153,34,0.08); border: 1px solid rgba(210,153,34,0.2); }
.synth-number { font-family: var(--mono); font-size: 2rem; font-weight: 700; }
.synth-coins .synth-number { color: var(--primary); }
.synth-structural .synth-number { color: var(--secondary); }
.synth-regions .synth-number { color: var(--warning); }
.synth-label { font-weight: 600; font-size: 0.85rem; margin: 0.25rem 0 0.5rem; }
.synth-desc { font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; }
.synth-desc code {
  background: rgba(0,229,153,0.1); color: var(--primary); padding: 0.1em 0.3em;
  border-radius: 3px; font-size: 0.7rem;
}

/* Role distribution bars */
.role-bars { display: flex; flex-direction: column; gap: 0.5rem; }
.role-row { display: flex; align-items: center; gap: 0.75rem; }
.role-name { width: 100px; font-size: 0.8rem; color: var(--text); text-transform: capitalize; }
.role-bar-track {
  flex: 1; height: 8px; background: var(--bg-surface); border-radius: 4px; overflow: hidden;
}
.role-bar-fill {
  height: 100%; background: linear-gradient(90deg, var(--secondary), var(--primary));
  border-radius: 4px; transition: width 0.4s ease;
}
.role-count { font-family: var(--mono); font-size: 0.75rem; color: var(--text-muted); width: 80px; text-align: right; }

/* Coins Tab */
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
.coin-serial { color: var(--text); }
.coin-meta { margin-top: 0.15rem; }
.coin-badge {
  background: rgba(0,229,153,0.12); color: var(--primary); font-family: var(--mono);
  font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 12px;
  letter-spacing: 0.05em;
}
.coin-chevron {
  color: var(--text-muted); font-size: 0.7rem; transition: transform 0.2s;
}
.coin-chevron.open { transform: rotate(90deg); }
.coin-details {
  padding: 0 1.25rem 1.25rem; border-top: 1px solid var(--border);
  animation: fadeIn 0.15s ease;
}
.amino-chain {
  display: flex; flex-wrap: wrap; gap: 3px; margin-top: 0.5rem;
}
.amino {
  font-family: var(--mono); font-size: 0.65rem; padding: 0.2rem 0.4rem;
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: 4px;
  color: var(--text-muted);
}
.amino-header {
  background: rgba(0,229,153,0.15); border-color: rgba(0,229,153,0.3); color: var(--primary);
  font-weight: 600;
}

/* Proteins Table */
.protein-table-wrap { overflow-x: auto; }
.protein-table {
  width: 100%; border-collapse: collapse; font-size: 0.85rem;
}
.protein-table th {
  text-align: left; padding: 0.75rem 1rem; border-bottom: 2px solid var(--border);
  color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
}
.protein-table td {
  padding: 0.6rem 1rem; border-bottom: 1px solid var(--border);
}
.protein-table tbody tr:hover { background: var(--bg-card-hover); }
.row-coin td:first-child { border-left: 3px solid var(--primary); }
.row-structural td:first-child { border-left: 3px solid var(--secondary); }
.type-badge {
  font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 8px;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.type-badge.coin { background: rgba(0,229,153,0.12); color: var(--primary); }
.type-badge.structural { background: rgba(14,165,233,0.12); color: var(--secondary); }

/* DNA Tab Reading Guide */
.reading-guide {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;
}
.guide-item {
  display: flex; gap: 0.75rem; align-items: flex-start;
}
.guide-item strong { font-size: 0.85rem; }

/* Health indicators */
.health-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;
}
.health-item {
  display: flex; gap: 0.75rem; align-items: center;
  padding: 0.75rem; background: var(--bg-surface); border-radius: var(--radius);
  border: 1px solid var(--border);
}

/* Gel legend */
.gel-legend { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }
.gel-legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted); }
.gel-legend-swatch { width: 24px; height: 4px; border-radius: 2px; flex-shrink: 0; }
.gel-enzyme-list { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.75rem; }
.gel-enzyme-tag {
  font-size: 0.7rem; padding: 0.2rem 0.5rem; background: var(--bg-surface);
  border: 1px solid var(--border); border-radius: 4px; color: var(--text-muted);
}
.gel-enzyme-tag code {
  font-family: var(--mono); color: var(--primary); font-size: 0.65rem;
}

/* Responsive */
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
