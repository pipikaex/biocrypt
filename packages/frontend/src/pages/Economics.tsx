import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../hooks/useReveal";
import { api, type NetworkStats } from "../api";

const MAX_SUPPLY = 21_000_000;
const HALVING_INTERVAL = 210_000;
const INITIAL_REWARD = 50;

function computeHalvingSchedule() {
  const eras: { era: number; name: string; reward: number; coins: number; cumulative: number; pct: number }[] = [];
  let cumulative = 0;
  const names = ["Genesis", "Growth", "Expansion", "Maturity", "Stability", "Consolidation", "Scarcity", "Twilight", "Final", "Senescence"];
  for (let i = 0; i < 10; i++) {
    const reward = Math.max(1, Math.floor(INITIAL_REWARD / Math.pow(2, i)));
    const coins = HALVING_INTERVAL * reward;
    cumulative += coins;
    if (cumulative > MAX_SUPPLY) cumulative = MAX_SUPPLY;
    eras.push({ era: i + 1, name: names[i], reward, coins, cumulative, pct: Math.round((cumulative / MAX_SUPPLY) * 100) });
    if (cumulative >= MAX_SUPPLY) break;
  }
  return eras;
}

const HALVING_SCHEDULE = computeHalvingSchedule();

export function Economics() {
  const [stats, setStats] = useState<NetworkStats | null>(null);

  useEffect(() => {
    api.getNetworkStats().then(setStats).catch(() => {});
    const iv = setInterval(() => { api.getNetworkStats().then(setStats).catch(() => {}); }, 15000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="page econ-page">
      <HeroSection />
      <ComparisonSection />
      <MiningLoopSection />
      <TelomereSection stats={stats} />
      <HalvingSection stats={stats} />
      <SecurityLayersSection />
      <ValueSection />
      {stats && <LiveStatsSection stats={stats} />}
      <CTASection />
      <style>{econStyles}</style>
    </div>
  );
}

function HeroSection() {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`econ-hero ${r.visible ? "revealed" : ""}`}>
      <div className="econ-hero-bg">
        <svg viewBox="0 0 200 200" className="econ-helix-svg">
          {Array.from({ length: 20 }).map((_, i) => {
            const y = i * 10;
            const x1 = 60 + Math.sin(i * 0.5) * 40;
            const x2 = 140 - Math.sin(i * 0.5) * 40;
            return (
              <g key={i} style={{ animationDelay: `${i * 0.1}s` }} className="helix-rung">
                <circle cx={x1} cy={y} r="3" className="helix-base-a" />
                <circle cx={x2} cy={y} r="3" className="helix-base-b" />
                <line x1={x1} y1={y} x2={x2} y2={y} className="helix-bond" />
              </g>
            );
          })}
        </svg>
      </div>
      <h1 className="econ-title">What Gives <span className="text-primary">BioCrypt</span> Its Value?</h1>
      <p className="econ-subtitle">
        A 21-million hard cap enforced by biological telomere shortening. Bitcoin-style halving.
        Proof-of-work mining. Deflationary burns. Four layers of cryptographic security.
      </p>
      <div className="econ-hero-stats">
        <div className="econ-hero-stat">
          <div className="econ-hero-stat-val">21M</div>
          <div className="econ-hero-stat-lbl">Max Supply</div>
        </div>
        <div className="econ-hero-stat">
          <div className="econ-hero-stat-val">50 ZBIO</div>
          <div className="econ-hero-stat-lbl">Initial Block Reward</div>
        </div>
        <div className="econ-hero-stat">
          <div className="econ-hero-stat-val">210K</div>
          <div className="econ-hero-stat-lbl">Halving Interval</div>
        </div>
        <div className="econ-hero-stat">
          <div className="econ-hero-stat-val">4</div>
          <div className="econ-hero-stat-lbl">Security Layers</div>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`econ-section ${r.visible ? "revealed" : ""}`}>
      <h2 className="econ-section-title">Bitcoin vs BioCrypt</h2>
      <p className="econ-section-sub">Same economic principles. Different technology. Biological innovation.</p>
      <div className="compare-grid">
        <div className="compare-col compare-btc">
          <div className="compare-icon">
            <svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18" fill="none" stroke="#f7931a" strokeWidth="2"/><text x="20" y="26" textAnchor="middle" fill="#f7931a" fontSize="18" fontWeight="bold">B</text></svg>
          </div>
          <h3>Bitcoin</h3>
          <div className="compare-items">
            <CompareItem label="Store" value="Blockchain" />
            <CompareItem label="Identity" value="Hash addresses" />
            <CompareItem label="Mining" value="SHA-256 PoW" />
            <CompareItem label="Supply Cap" value="21M BTC" />
            <CompareItem label="Halving" value="Every 210K blocks" />
            <CompareItem label="Transfers" value="Need miners" />
            <CompareItem label="Offline?" value="No" />
            <CompareItem label="Visual Proof" value="None" />
          </div>
        </div>
        <div className="compare-vs">VS</div>
        <div className="compare-col compare-biocrypt">
          <div className="compare-icon">
            <svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18" fill="none" stroke="var(--primary)" strokeWidth="2"/><text x="20" y="26" textAnchor="middle" fill="var(--primary)" fontSize="16" fontWeight="bold">Z</text></svg>
          </div>
          <h3>BioCrypt</h3>
          <div className="compare-items">
            <CompareItem label="Store" value="DNA strands" highlight />
            <CompareItem label="Identity" value="Protein keys" highlight />
            <CompareItem label="Mining" value="SHA-256 PoW" />
            <CompareItem label="Supply Cap" value="21M ZBIO" />
            <CompareItem label="Halving" value="Every 210K subs" />
            <CompareItem label="Transfers" value="Peer-to-peer mRNA" highlight />
            <CompareItem label="Offline?" value="Yes (Ed25519+RFLP)" highlight />
            <CompareItem label="Visual Proof" value="Gel electrophoresis" highlight />
          </div>
        </div>
      </div>
    </section>
  );
}

function CompareItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`compare-item ${highlight ? "compare-highlight" : ""}`}>
      <span className="compare-label">{label}</span>
      <span className="compare-value">{value}</span>
    </div>
  );
}

function MiningLoopSection() {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`econ-section ${r.visible ? "revealed" : ""}`}>
      <h2 className="econ-section-title">The Economic Loop</h2>
      <p className="econ-section-sub">Mining creates value. Transfers burn supply. Scarcity drives demand.</p>
      <div className="loop-container">
        <div className="loop-ring">
          <LoopNode pos="top" icon={"\u26CF\uFE0F"} label="Miner solves PoW" detail="SHA-256 proof" delay={0} />
          <LoopNode pos="right" icon={"\u{1F9EC}"} label="Network signs each ZBIO" detail="Ed25519 + RFLP" delay={0.3} />
          <LoopNode pos="bottom" icon={"\u{1F4B0}"} label="Block reward earned" detail="50 ZBIO (Era 1)" delay={0.6} />
          <LoopNode pos="left" icon={"\u{1F525}"} label="Transfers burn 1%" detail="Deflationary" delay={0.9} />
          <div className="loop-center">
            <div className="loop-center-val">21M</div>
            <div className="loop-center-lbl">hard cap</div>
          </div>
          <svg className="loop-arrows" viewBox="0 0 300 300">
            <defs>
              <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--primary)" opacity="0.5" />
              </marker>
            </defs>
            <path d="M 150 30 A 120 120 0 0 1 270 150" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.3" markerEnd="url(#arrowHead)" />
            <path d="M 270 150 A 120 120 0 0 1 150 270" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.3" markerEnd="url(#arrowHead)" />
            <path d="M 150 270 A 120 120 0 0 1 30 150" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.3" markerEnd="url(#arrowHead)" />
            <path d="M 30 150 A 120 120 0 0 1 150 30" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.3" markerEnd="url(#arrowHead)" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function LoopNode({ pos, icon, label, detail, delay }: { pos: string; icon: string; label: string; detail: string; delay: number }) {
  return (
    <div className={`loop-node loop-${pos}`} style={{ animationDelay: `${delay}s` }}>
      <div className="loop-node-icon">{icon}</div>
      <div className="loop-node-label">{label}</div>
      <div className="loop-node-detail">{detail}</div>
    </div>
  );
}

function TelomereSection({ stats }: { stats: NetworkStats | null }) {
  const r = useReveal();
  const pct = stats?.telomerePercent ?? 100;
  const mined = stats?.totalCoins ?? 0;

  return (
    <section ref={r.ref} className={`econ-section econ-telomere ${r.visible ? "revealed" : ""}`}>
      <h2 className="econ-section-title">The Telomere Hard Cap</h2>
      <p className="econ-section-sub">
        In biology, telomeres (TTAGGG repeats) protect chromosome ends. Each cell division shortens them.
        When they're gone, the cell can no longer divide — the <strong>Hayflick limit</strong>.
      </p>
      <div className="telomere-vis">
        <div className="chromosome">
          <div className="telomere-cap telomere-left" style={{ width: `${Math.max(2, pct / 2)}%` }}>
            <div className="telomere-glow" />
            <span className="telomere-label">TTAGGG</span>
          </div>
          <div className="chromosome-body">
            <div className="chromosome-fill" style={{ width: `${Math.min(100, (mined / MAX_SUPPLY) * 100)}%` }} />
            <span className="chromosome-text">{mined.toLocaleString()} / {MAX_SUPPLY.toLocaleString()}</span>
          </div>
          <div className="telomere-cap telomere-right" style={{ width: `${Math.max(2, pct / 2)}%` }}>
            <div className="telomere-glow" />
            <span className="telomere-label">TTAGGG</span>
          </div>
        </div>
        <div className="telomere-stats">
          <div className="telomere-stat">
            <div className="telomere-stat-val">{pct.toFixed(2)}%</div>
            <div className="telomere-stat-lbl">Telomere remaining</div>
          </div>
          <div className="telomere-stat">
            <div className="telomere-stat-val">{(MAX_SUPPLY - mined).toLocaleString()}</div>
            <div className="telomere-stat-lbl">ZBIO left to mine</div>
          </div>
        </div>
      </div>
      <div className="telomere-explain">
        <div className="telomere-explain-card">
          <div className="telomere-explain-icon">{"\u{1F9EC}"}</div>
          <h4>Each mine shortens telomeres</h4>
          <p>Every block reward consumed removes TTAGGG repeats from the network's chromosome, just like cell division in biology.</p>
        </div>
        <div className="telomere-explain-card">
          <div className="telomere-explain-icon">{"\u{1F480}"}</div>
          <h4>Hayflick limit = 21M</h4>
          <p>When telomeres reach zero, no more ZBIO can ever be created. The network has reached its biological lifespan limit.</p>
        </div>
        <div className="telomere-explain-card">
          <div className="telomere-explain-icon">{"\u267E\uFE0F"}</div>
          <h4>ZBIO lasts forever</h4>
          <p>Existing ZBIO remains valid and tradeable forever. Only new creation stops. Scarcity is permanent and unforgeable.</p>
        </div>
      </div>
    </section>
  );
}

function HalvingSection({ stats }: { stats: NetworkStats | null }) {
  const r = useReveal();
  const currentEra = stats?.halvingEra ?? 0;

  return (
    <section ref={r.ref} className={`econ-section ${r.visible ? "revealed" : ""}`}>
      <h2 className="econ-section-title">Halving Schedule</h2>
      <p className="econ-section-sub">Block rewards halve every 210,000 submissions — identical to Bitcoin's model.</p>
      <div className="halving-timeline">
        {HALVING_SCHEDULE.map((era, i) => (
          <div key={i} className={`halving-era ${i === currentEra ? "halving-current" : ""} ${i < currentEra ? "halving-past" : ""}`}>
            <div className="halving-connector" />
            <div className="halving-dot" />
            <div className="halving-card">
              <div className="halving-era-badge">Era {era.era}</div>
              <div className="halving-era-name">{era.name}</div>
              <div className="halving-reward">
                <span className="halving-reward-val">{era.reward}</span>
                <span className="halving-reward-lbl">ZBIO / mine</span>
              </div>
              <div className="halving-cumulative">
                <div className="halving-bar">
                  <div className="halving-bar-fill" style={{ width: `${era.pct}%` }} />
                </div>
                <span className="halving-pct">{era.pct}% of supply</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SecurityLayersSection() {
  const r = useReveal();
  const layers = [
    { icon: "\u26CF\uFE0F", name: "Proof of Work", desc: "SHA-256 hash puzzle — costs real energy to mine each ZBIO", color: "#f59e0b" },
    { icon: "\u{1F511}", name: "Ed25519 Signatures", desc: "Network signs every ZBIO with its secret DNA keypair", color: "#3b82f6" },
    { icon: "\u{1F9EC}", name: "RFLP Fingerprinting", desc: "Restriction enzyme gel bands prove ZBIO parentage visually", color: "#8b5cf6" },
    { icon: "\u{1F6E1}\uFE0F", name: "Nullifier Registry", desc: "Deterministic hashes prevent any ZBIO from being spent twice", color: "#ef4444" },
  ];

  return (
    <section ref={r.ref} className={`econ-section ${r.visible ? "revealed" : ""}`}>
      <h2 className="econ-section-title">Four Layers of Defense</h2>
      <p className="econ-section-sub">To forge a BioCrypt coin, an attacker must break all four independently — computationally infeasible.</p>
      <div className="security-stack">
        {layers.map((l, i) => (
          <div key={i} className="security-layer-card" style={{ animationDelay: `${i * 0.15}s`, borderLeftColor: l.color }}>
            <div className="security-layer-num">Layer {i + 1}</div>
            <div className="security-layer-icon">{l.icon}</div>
            <div className="security-layer-body">
              <h4>{l.name}</h4>
              <p>{l.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ValueSection() {
  const r = useReveal();
  const reasons = [
    { icon: "\u{1F48E}", title: "Scarcity", desc: "21 million cap enforced by telomere biology. No inflation possible after Hayflick limit." },
    { icon: "\u{1F525}", title: "Deflationary", desc: "1% of transfers are burned, permanently reducing circulating supply over time." },
    { icon: "\u26A1", title: "Utility", desc: "Payment gateway, marketplace integration. Use ZBIO to buy, sell, and trade real goods." },
    { icon: "\u{1F310}", title: "Offline-First", desc: "Verify and trade without internet. Ed25519 + RFLP work anywhere, no server needed." },
    { icon: "\u{1F512}", title: "Unbreakable", desc: "Four independent security layers. Breaking one still leaves three protecting your ZBIO." },
    { icon: "\u{1F9EC}", title: "Unique Biology", desc: "Every ZBIO has its own DNA, its own protein fingerprint, its own gel electrophoresis pattern." },
  ];

  return (
    <section ref={r.ref} className={`econ-section ${r.visible ? "revealed" : ""}`}>
      <h2 className="econ-section-title">Why BioCrypt Has Value</h2>
      <div className="value-grid">
        {reasons.map((r, i) => (
          <div key={i} className="value-card" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="value-icon">{r.icon}</div>
            <h4>{r.title}</h4>
            <p>{r.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiveStatsSection({ stats }: { stats: NetworkStats }) {
  const r = useReveal();
  const pct = stats.telomerePercent ?? 100;

  return (
    <section ref={r.ref} className={`econ-section econ-live ${r.visible ? "revealed" : ""}`}>
      <h2 className="econ-section-title">Live Network Economics</h2>
      <p className="econ-section-sub">Real-time data from the BioCrypt network.</p>
      <div className="live-grid">
        <LiveStat label="Total Mined" value={stats.totalCoins.toLocaleString()} sub={`of ${MAX_SUPPLY.toLocaleString()} ZBIO`} />
        <LiveStat label="Circulating" value={(stats.circulatingSupply ?? stats.totalCoins).toLocaleString()} sub={`${stats.burnedCoins ?? 0} ZBIO burned`} />
        <LiveStat label="Block Reward" value={`${stats.currentReward ?? "?"}`} sub={`ZBIO per mine`} />
        <LiveStat label="Halving Era" value={stats.halvingEraName ?? "Genesis"} sub={`Era ${(stats.halvingEra ?? 0) + 1}`} />
        <LiveStat label="Until Halving" value={(stats.coinsUntilHalving ?? 0).toLocaleString()} sub="submissions left" />
        <LiveStat label="Telomere" value={`${pct.toFixed(2)}%`} sub="remaining" />
        <LiveStat label="Difficulty" value={`${stats.difficulty.length} zeros`} sub={stats.difficulty} />
        <LiveStat label="Submissions" value={stats.totalSubmissions.toLocaleString()} sub={`Epoch ${stats.epochProgress}`} />
      </div>

      <div className="live-telomere-bar">
        <div className="live-telomere-fill" style={{ width: `${pct}%` }} />
        <div className="live-telomere-text">
          Telomere: {pct.toFixed(2)}% — {(MAX_SUPPLY - stats.totalCoins).toLocaleString()} ZBIO remain
        </div>
      </div>
    </section>
  );
}

function LiveStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="live-stat">
      <div className="live-stat-label">{label}</div>
      <div className="live-stat-value">{value}</div>
      <div className="live-stat-sub">{sub}</div>
    </div>
  );
}

function CTASection() {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`econ-section econ-cta ${r.visible ? "revealed" : ""}`}>
      <h2>Start Mining Before Telomeres Run Out</h2>
      <p className="text-muted" style={{ maxWidth: 500, margin: "0 auto 1.5rem" }}>
        Every block reward shrinks the network's telomeres. Once they hit zero, mining is over forever.
        The earlier you mine, the higher the reward.
      </p>
      <div className="flex gap-1 justify-center flex-wrap">
        <Link to="/mine" className="btn btn-primary btn-glow">Start Mining</Link>
        <Link to="/wallet" className="btn btn-secondary">Create Wallet</Link>
        <Link to="/how-it-works" className="btn btn-secondary">How It Works</Link>
      </div>
    </section>
  );
}

const econStyles = `
.econ-page { max-width: 960px; margin: 0 auto; }

/* Reveal animation */
.econ-hero, .econ-section {
  opacity: 0; transform: translateY(30px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.econ-hero.revealed, .econ-section.revealed {
  opacity: 1; transform: translateY(0);
}

/* Hero */
.econ-hero {
  text-align: center; padding: 4rem 0 3rem; position: relative; overflow: hidden;
}
.econ-hero-bg {
  position: absolute; inset: 0; display: flex; justify-content: center; opacity: 0.08;
  pointer-events: none;
}
.econ-helix-svg { height: 100%; width: auto; }
.helix-base-a { fill: var(--primary); }
.helix-base-b { fill: var(--secondary); }
.helix-bond { stroke: var(--text-dim); stroke-width: 0.5; }
.helix-rung { animation: helixFade 2s ease-in-out infinite alternate; }
@keyframes helixFade {
  0% { opacity: 0.3; }
  100% { opacity: 1; }
}
.econ-title {
  font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 900;
  line-height: 1.15; margin-bottom: 1rem; position: relative;
}
.econ-subtitle {
  color: var(--text-muted); font-size: 1.1rem; max-width: 650px;
  margin: 0 auto 2rem; line-height: 1.6; position: relative;
}
.econ-hero-stats {
  display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; position: relative;
}
.econ-hero-stat {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1rem 1.5rem; min-width: 120px; text-align: center;
}
.econ-hero-stat-val {
  font-family: var(--mono); font-size: 1.6rem; font-weight: 800; color: var(--primary);
}
.econ-hero-stat-lbl { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem; }

/* Section common */
.econ-section { padding: 3rem 0; }
.econ-section-title {
  text-align: center; font-size: clamp(1.5rem, 3.5vw, 2.2rem);
  font-weight: 800; margin-bottom: 0.5rem;
}
.econ-section-sub {
  text-align: center; color: var(--text-muted); max-width: 600px;
  margin: 0 auto 2rem; line-height: 1.5;
}

/* Comparison */
.compare-grid {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 1.5rem;
  align-items: start;
}
.compare-col {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1.5rem; text-align: center;
}
.compare-col h3 { margin: 0.75rem 0 1rem; font-size: 1.2rem; }
.compare-icon { display: flex; justify-content: center; }
.compare-vs {
  align-self: center; font-weight: 900; font-size: 1.2rem;
  color: var(--text-dim); padding: 0 0.5rem;
}
.compare-items { display: flex; flex-direction: column; gap: 0.5rem; }
.compare-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem 0.75rem; border-radius: var(--radius);
  background: var(--bg-surface); font-size: 0.85rem;
}
.compare-label { color: var(--text-muted); }
.compare-value { font-weight: 600; }
.compare-highlight { border-left: 3px solid var(--primary); }
.compare-highlight .compare-value { color: var(--primary); }

@media (max-width: 640px) {
  .compare-grid { grid-template-columns: 1fr; }
  .compare-vs { text-align: center; padding: 0.5rem 0; }
}

/* Mining Loop */
.loop-container {
  display: flex; justify-content: center; padding: 2rem 0;
}
.loop-ring {
  position: relative; width: 300px; height: 300px;
}
.loop-node {
  position: absolute; text-align: center; width: 130px;
  animation: loopPop 0.5s ease both;
}
.loop-top { top: -20px; left: 50%; transform: translateX(-50%); }
.loop-right { right: -50px; top: 50%; transform: translateY(-50%); }
.loop-bottom { bottom: -20px; left: 50%; transform: translateX(-50%); }
.loop-left { left: -50px; top: 50%; transform: translateY(-50%); }
@keyframes loopPop {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; }
}
.loop-node-icon { font-size: 1.8rem; margin-bottom: 0.25rem; }
.loop-node-label { font-weight: 600; font-size: 0.8rem; }
.loop-node-detail { font-size: 0.7rem; color: var(--text-muted); }
.loop-center {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  text-align: center;
}
.loop-center-val {
  font-family: var(--mono); font-size: 2rem; font-weight: 900; color: var(--primary);
}
.loop-center-lbl { font-size: 0.75rem; color: var(--text-muted); }
.loop-arrows {
  position: absolute; inset: 0; width: 100%; height: 100%;
}

@media (max-width: 480px) {
  .loop-ring { transform: scale(0.75); }
}

/* Telomere */
.econ-telomere {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 3rem 2rem; margin: 1rem 0;
}
.telomere-vis { margin-bottom: 2rem; }
.chromosome {
  display: flex; align-items: center; height: 48px; margin-bottom: 1.5rem;
  border-radius: 999px; overflow: hidden;
  background: var(--bg-surface); border: 2px solid var(--border);
}
.telomere-cap {
  position: relative; height: 100%; min-width: 20px;
  background: linear-gradient(90deg, var(--primary), rgba(0,229,153,0.3));
  display: flex; align-items: center; justify-content: center;
  transition: width 1s ease;
}
.telomere-right {
  background: linear-gradient(270deg, var(--primary), rgba(0,229,153,0.3));
}
.telomere-glow {
  position: absolute; inset: 0;
  background: var(--primary); opacity: 0.2;
  animation: telomerePulse 2s ease-in-out infinite;
}
@keyframes telomerePulse {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.35; }
}
.telomere-label {
  font-family: var(--mono); font-size: 0.55rem; color: var(--bg);
  font-weight: 700; position: relative; white-space: nowrap;
}
.chromosome-body {
  flex: 1; height: 100%; position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.chromosome-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, rgba(0,229,153,0.1), rgba(0,229,153,0.05));
  transition: width 1s ease;
}
.chromosome-text {
  position: relative; font-family: var(--mono); font-size: 0.8rem;
  font-weight: 600; color: var(--text);
}
.telomere-stats {
  display: flex; gap: 2rem; justify-content: center;
}
.telomere-stat { text-align: center; }
.telomere-stat-val {
  font-family: var(--mono); font-size: 1.5rem; font-weight: 800; color: var(--primary);
}
.telomere-stat-lbl { font-size: 0.75rem; color: var(--text-muted); }

.telomere-explain {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem; margin-top: 2rem;
}
.telomere-explain-card {
  text-align: center; padding: 1rem;
}
.telomere-explain-icon { font-size: 2rem; margin-bottom: 0.5rem; }
.telomere-explain-card h4 { margin-bottom: 0.35rem; font-size: 0.95rem; }
.telomere-explain-card p { color: var(--text-muted); font-size: 0.8rem; line-height: 1.5; }

/* Halving Timeline */
.halving-timeline {
  display: flex; flex-direction: column; gap: 0; position: relative;
  padding-left: 24px;
}
.halving-era {
  position: relative; padding: 0.75rem 0 0.75rem 2rem;
}
.halving-connector {
  position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
  background: var(--border);
}
.halving-dot {
  position: absolute; left: -5px; top: 50%; transform: translateY(-50%);
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--bg-card); border: 2px solid var(--border);
  z-index: 1;
}
.halving-current .halving-dot {
  background: var(--primary); border-color: var(--primary);
  box-shadow: 0 0 8px var(--primary-glow);
}
.halving-past .halving-dot { background: var(--text-dim); border-color: var(--text-dim); }
.halving-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1rem 1.25rem;
  display: grid; grid-template-columns: auto 1fr auto; gap: 0.5rem 1rem;
  align-items: center;
}
.halving-current .halving-card {
  border-color: var(--primary); box-shadow: 0 0 12px rgba(0,229,153,0.1);
}
.halving-era-badge {
  font-family: var(--mono); font-size: 0.7rem; font-weight: 700;
  background: var(--bg-surface); padding: 0.2rem 0.5rem; border-radius: var(--radius);
  color: var(--text-muted);
}
.halving-current .halving-era-badge { background: var(--primary-glow); color: var(--primary); }
.halving-era-name { font-weight: 700; font-size: 1rem; }
.halving-reward { text-align: right; }
.halving-reward-val {
  font-family: var(--mono); font-size: 1.3rem; font-weight: 800; color: var(--primary);
}
.halving-reward-lbl { font-size: 0.65rem; color: var(--text-muted); }
.halving-cumulative {
  grid-column: 1 / -1; display: flex; align-items: center; gap: 0.75rem;
}
.halving-bar {
  flex: 1; height: 6px; background: var(--bg-surface); border-radius: 3px; overflow: hidden;
}
.halving-bar-fill {
  height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary));
  border-radius: 3px; transition: width 0.5s;
}
.halving-pct { font-family: var(--mono); font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; }

/* Security Layers */
.security-stack { display: flex; flex-direction: column; gap: 0.75rem; max-width: 600px; margin: 0 auto; }
.security-layer-card {
  display: flex; align-items: center; gap: 1rem;
  background: var(--bg-card); border: 1px solid var(--border);
  border-left: 4px solid; border-radius: var(--radius); padding: 1rem 1.25rem;
  animation: slideInLeft 0.5s ease both;
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
.security-layer-num {
  font-family: var(--mono); font-size: 0.65rem; font-weight: 700;
  color: var(--text-dim); white-space: nowrap;
}
.security-layer-icon { font-size: 1.5rem; }
.security-layer-body h4 { margin-bottom: 0.15rem; font-size: 0.95rem; }
.security-layer-body p { color: var(--text-muted); font-size: 0.8rem; margin: 0; }

/* Value Grid */
.value-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}
.value-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1.5rem; text-align: center;
  transition: border-color 0.2s, transform 0.2s;
  animation: fadeUp 0.5s ease both;
}
.value-card:hover { border-color: var(--border-bright); transform: translateY(-2px); }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}
.value-icon { font-size: 2rem; margin-bottom: 0.5rem; }
.value-card h4 { margin-bottom: 0.35rem; }
.value-card p { color: var(--text-muted); font-size: 0.85rem; margin: 0; line-height: 1.5; }

/* Live Stats */
.econ-live {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 2.5rem 2rem;
}
.live-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem; margin-bottom: 1.5rem;
}
.live-stat {
  text-align: center; padding: 0.75rem;
  background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border);
}
.live-stat-label { font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem; }
.live-stat-value { font-family: var(--mono); font-size: 1.2rem; font-weight: 700; color: var(--primary); }
.live-stat-sub { font-size: 0.65rem; color: var(--text-dim); margin-top: 0.15rem; }
.live-telomere-bar {
  position: relative; height: 32px; border-radius: 16px;
  background: var(--bg-surface); border: 1px solid var(--border); overflow: hidden;
}
.live-telomere-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, var(--primary), rgba(0,229,153,0.3));
  border-radius: 16px; transition: width 1s ease;
}
.live-telomere-text {
  position: relative; z-index: 1; display: flex; align-items: center; justify-content: center;
  height: 100%; font-family: var(--mono); font-size: 0.75rem; font-weight: 600;
}

/* CTA */
.econ-cta { text-align: center; padding: 3rem 0; }
.econ-cta h2 { font-size: clamp(1.3rem, 3vw, 1.8rem); margin-bottom: 0.75rem; }

@media (max-width: 640px) {
  .econ-hero { padding: 2rem 0; }
  .econ-hero-stats { gap: 0.75rem; }
  .econ-hero-stat { min-width: 100px; padding: 0.75rem 1rem; }
  .econ-hero-stat-val { font-size: 1.2rem; }
  .halving-card { grid-template-columns: 1fr; }
  .halving-reward { text-align: left; }
  .econ-telomere { padding: 2rem 1rem; }
}
`;
