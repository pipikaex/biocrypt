import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, type NetworkStats } from "../api";
import { useReveal } from "../hooks/useReveal";

function useParallax() {
  const ref = useRef<HTMLDivElement>(null);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = (vh - r.top) / (vh + r.height);
    el.style.setProperty("--px", `${(progress - 0.5) * 60}px`);
    el.style.setProperty("--pp", `${progress}`);
  }, []);
  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);
  return ref;
}

function FloatingBases({ count = 30 }: { count?: number }) {
  const bases = useRef(
    Array.from({ length: count }, () => ({
      char: "TACG"[Math.floor(Math.random() * 4)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 10 + Math.random() * 14,
      dur: 12 + Math.random() * 20,
      delay: -Math.random() * 20,
      opacity: 0.04 + Math.random() * 0.06,
    }))
  ).current;
  return (
    <div className="floating-bases" aria-hidden="true">
      {bases.map((b, i) => (
        <span key={i} className="float-base" style={{
          left: `${b.x}%`, top: `${b.y}%`, fontSize: `${b.size}px`,
          animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`,
          opacity: b.opacity,
        }}>{b.char}</span>
      ))}
    </div>
  );
}

function SideHelix({ side = "left", top = "10%" }: { side?: "left" | "right"; top?: string }) {
  return (
    <div className={`side-helix side-helix-${side}`} style={{ top }} aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <div key={i} className="sh-rung" style={{ animationDelay: `${i * 0.15}s` }}>
          <span className="sh-dot sh-l" />
          <span className="sh-bar" />
          <span className="sh-dot sh-r" />
        </div>
      ))}
    </div>
  );
}

export function Landing() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  useEffect(() => { api.getNetworkStats().then(setStats).catch(() => {}); }, []);

  return (
    <div className="landing">
      <FloatingBases count={40} />
      <HeroSlider />
      <Ticker stats={stats} />
      <WhySection />
      <GelElectrophoresisSection />
      <FlowAnimation />
      <HowItWorks />
      <QuickStart />
      <ForEveryone />
      <Tokenomics stats={stats} />
      <SecuritySection />
      <PaymentGateway />
      <BuildYourOwn />
      <Roadmap />
      <Community />
      <FAQ />
      <CTA />
      <Footer />
      <style>{styles}</style>
    </div>
  );
}

/* ─── Hero Slider ──────────────────────────────────────────────────────── */

interface HeroSlide {
  tag?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  badges?: { label: string; color: string }[];
  visual?: React.ReactNode;
  stats?: { val: string; label: string }[];
  cta?: { label: string; to: string; primary?: boolean }[];
}

const HERO_SLIDES: HeroSlide[] = [
  {
    title: <>&ldquo;What if cryptocurrency was <span className="grad-text">alive</span>?&rdquo;</>,
    visual: <HelixAnimation />,
  },
  {
    title: <>&ldquo;What if your wallet had <span className="grad-text">DNA</span>&hellip;<br />your coins were <span className="grad-text">proteins</span>?&rdquo;</>,
    visual: <CodonVisual />,
  },
  {
    title: <>zcoin<span style={{ color: "var(--text-dim)", fontWeight: 500 }}>.bio</span></>,
    sub: "21 Million. DNA-Encoded. Unforgeable.",
    badges: [
      { label: "NO BLOCKCHAIN", color: "var(--primary)" },
      { label: "NO KYC", color: "#f85149" },
      { label: "NO GPU NEEDED", color: "var(--secondary)" },
      { label: "WORKS OFFLINE", color: "#d29922" },
    ],
  },
  {
    tag: "THE PROBLEM",
    title: <>Blockchain changed the world&hellip;<br />but every node stores <em>everything</em></>,
    sub: "The chain grows heavier with every block. KYC, fees, GPUs, and centralized exchanges hold you back.",
    visual: <BlockchainVisual />,
  },
  {
    tag: "INTRODUCING",
    title: <>Meet <span className="grad-text">zBioCoin</span></>,
    sub: "A cryptocurrency built on biology, not bureaucracy.",
    stats: [
      { val: "6,000", label: "DNA bases / wallet" },
      { val: "180", label: "bases / coin gene" },
      { val: "504", label: "bits of security" },
      { val: "21M", label: "max supply" },
      { val: "0", label: "KYC required" },
    ],
  },
  {
    tag: "MINE IN YOUR BROWSER",
    title: <>Open a tab. Click <span className="grad-text">Start Mining</span>. That&rsquo;s it.</>,
    sub: "SHA-256 Proof-of-Work — the same algorithm as Bitcoin. No GPU. No downloads. No signup.",
    badges: [
      { label: "SHA-256 PROOF-OF-WORK", color: "var(--primary)" },
      { label: "NO KYC", color: "#f85149" },
      { label: "RUNS ON ANY DEVICE", color: "var(--secondary)" },
    ],
    cta: [{ label: "Start Mining — Free", to: "/mine", primary: true }],
  },
  {
    tag: "BLOCK REWARDS",
    title: <>50 coins per block in the <span className="grad-text">Genesis Era</span></>,
    sub: "Every 210,000 submissions the reward halves — identical to Bitcoin.",
    stats: [
      { val: "50", label: "Genesis Era" },
      { val: "25", label: "Growth Era" },
      { val: "12", label: "Expansion Era" },
      { val: "6", label: "Maturity Era" },
      { val: "…", label: "→ Hayflick Limit" },
    ],
  },
  {
    tag: "THE TELOMERE CAP",
    title: <>Scarcity written into the <span className="grad-text">DNA</span></>,
    sub: "The network's DNA has TTAGGG telomeres. Every coin mined shortens them. When they're gone — mining stops forever.",
    visual: <TelomereVisual />,
  },
  {
    tag: "THE PATERNITY TEST",
    title: <>Every coin carries a <span className="grad-text">biological fingerprint</span></>,
    sub: "Five restriction enzymes cut the coin's marker DNA. The band pattern proves parentage — completely offline.",
    visual: <GelVisual />,
  },
  {
    tag: "FOUR LAYERS OF DEFENSE",
    title: <>504 bits of <span className="grad-text">combined security</span></>,
    visual: <ShieldsVisual />,
  },
  {
    tag: "TRANSFERS",
    title: <>Send coins via <span className="grad-text">mRNA payloads</span></>,
    sub: "Email. USB. QR code. Bluetooth. Verified offline. No server. No wait. No KYC.",
    visual: <MrnaVisual />,
  },
  {
    tag: "FINANCIAL FREEDOM",
    title: <span style={{ fontSize: "3rem", color: "#f85149", fontWeight: 900 }}>NO KYC</span>,
    sub: "No passport. No selfie. No bank account. Create a wallet in one click. Start using it instantly. Anywhere in the world.",
    badges: [
      { label: "NO IDENTITY REQUIRED", color: "var(--primary)" },
      { label: "NO EMAIL", color: "var(--primary)" },
      { label: "NO PHONE", color: "var(--primary)" },
    ],
  },
  {
    tag: "PAYMENT GATEWAY",
    title: <>Accept <span className="grad-text">zBioCoin</span> on any website</>,
    sub: "Like PayPal, Stripe, or Revolut — but powered by DNA. No credit card processor. No 3% fee. No chargebacks.",
    cta: [
      { label: "Try Demo Marketplace", to: "https://demo.zcoin.bio", primary: true },
      { label: "View Gateway Source", to: "https://github.com/pipikaex/biocoin-marketplace-demo-payment-gateway" },
    ],
  },
  {
    tag: "5 LINES OF CODE",
    title: <>Integrate zBioCoin <span className="grad-text">anywhere</span></>,
    visual: <CodeVisual />,
  },
  {
    tag: "MARKETPLACE",
    title: <>Buy &amp; sell coins <span className="grad-text">peer-to-peer</span></>,
    sub: "Don't want to mine? Buy coins from miners on the marketplace. Sell goods, sell services, sell coins. No middleman.",
    cta: [{ label: "Visit Marketplace", to: "https://demo.zcoin.bio", primary: true }],
  },
  {
    tag: "WHO IS zBioCoin FOR?",
    title: <>Whether you mine, build, trade, or spend</>,
    visual: <PersonaVisual />,
  },
  {
    tag: "THE zBioCoin ECONOMY",
    title: <>The <span className="grad-text">living economy</span></>,
    visual: <EconomyVisual />,
  },
  {
    tag: "EARLY ADOPTER ADVANTAGE",
    title: <>The earlier you mine, the <span className="grad-text">more you earn</span></>,
    sub: "Bitcoin's early miners became millionaires. This is your Genesis moment.",
    visual: <EarlyAdopterVisual />,
  },
  {
    tag: "JOIN THE ORGANISM",
    title: <span style={{ color: "var(--primary)" }}>zcoin.bio</span>,
    sub: "No ICO. No pre-mine. No venture capital. Open source. Live right now.",
    stats: [
      { val: "21M", label: "Hard Cap" },
      { val: "4", label: "Security Layers" },
      { val: "0", label: "Blockchain" },
      { val: "0", label: "KYC" },
      { val: "∞", label: "Coin Validity" },
    ],
    cta: [
      { label: "Start Mining", to: "/mine", primary: true },
      { label: "Create Wallet", to: "/wallet" },
    ],
  },
  {
    title: <>Bitcoin reimagined the economy.<br /><span className="grad-text">zBioCoin</span> reimagines it through <span className="grad-text">life itself</span>.</>,
    badges: [
      { label: "NO BLOCKCHAIN", color: "var(--primary)" },
      { label: "NO KYC", color: "#f85149" },
      { label: "NO MIDDLEMAN", color: "var(--secondary)" },
      { label: "NO FEES", color: "#d29922" },
      { label: "NO LIMITS", color: "#8b5cf6" },
    ],
    cta: [{ label: "Get Started — zcoin.bio", to: "/mine", primary: true }],
  },
];

function HeroSlider() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef(0);
  const len = HERO_SLIDES.length;

  const go = useCallback((i: number) => setIdx((i + len) % len), [len]);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(() => go(idx + 1), 7000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [idx, paused, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, go]);

  const slide = HERO_SLIDES[idx];

  return (
    <section
      className="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="hero-bg">
        <div className="hero-grid" />
        <div className="hero-glow hero-glow-parallax" />
        <SideHelix side="left" top="15%" />
        <SideHelix side="right" top="55%" />
      </div>

      <div className="hero-slide-content" key={idx}>
        {slide.tag && <div className="hero-badge anim-fade-down">{slide.tag}</div>}
        <h1 className="hero-title anim-fade-up" style={{ animationDelay: "0.1s" }}>{slide.title}</h1>
        {slide.sub && <p className="hero-sub anim-fade-up" style={{ animationDelay: "0.25s" }}>{slide.sub}</p>}
        {slide.visual && <div className="hero-visual anim-fade-up" style={{ animationDelay: "0.2s" }}>{slide.visual}</div>}
        {slide.stats && (
          <div className="hero-stats anim-fade-up" style={{ animationDelay: "0.35s" }}>
            {slide.stats.map((s, i) => (
              <div key={i} className="hero-stat">
                <div className="hero-stat-val">{s.val}</div>
                <div className="hero-stat-lbl">{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {slide.badges && (
          <div className="hero-badges anim-fade-up" style={{ animationDelay: "0.4s" }}>
            {slide.badges.map((b, i) => (
              <span key={i} className="hero-pill" style={{ borderColor: b.color, color: b.color }}>{b.label}</span>
            ))}
          </div>
        )}
        {slide.cta && (
          <div className="hero-actions anim-fade-up" style={{ animationDelay: "0.5s" }}>
            {slide.cta.map((c, i) =>
              c.to.startsWith("http") ? (
                <a key={i} href={c.to} target="_blank" rel="noopener" className={`btn ${c.primary ? "btn-primary btn-glow" : "btn-secondary"} btn-lg`}>{c.label}</a>
              ) : (
                <Link key={i} to={c.to} className={`btn ${c.primary ? "btn-primary btn-glow" : "btn-secondary"} btn-lg`}>{c.label}</Link>
              )
            )}
          </div>
        )}
      </div>

      <button className="hero-arrow hero-arrow-prev" onClick={() => go(idx - 1)} aria-label="Previous">&lsaquo;</button>
      <button className="hero-arrow hero-arrow-next" onClick={() => go(idx + 1)} aria-label="Next">&rsaquo;</button>

      <div className="hero-dots">
        {HERO_SLIDES.map((_, i) => (
          <button key={i} className={`hero-dot ${i === idx ? "active" : ""}`} onClick={() => go(i)} />
        ))}
      </div>

      <div className="hero-counter">{idx + 1} / {len}</div>
    </section>
  );
}

/* ── Slide mini-components ──────────────────────────────────────────── */

function HelixAnimation() {
  return (
    <div className="helix-wrap" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <div key={i} className="helix-rung" style={{ animationDelay: `${i * 0.12}s` }}>
          <span className="h-dot l" />
          <span className="h-bar" />
          <span className="h-dot r" />
        </div>
      ))}
    </div>
  );
}

function CodonVisual() {
  const codons = [
    { bases: "T A C G", color: "#ef4444", amino: "Tyr" },
    { bases: "A T G", color: "#f59e0b", amino: "Met" },
    { bases: "G G G", color: "#3b82f6", amino: "Gly" },
    { bases: "T G G", color: "#8b5cf6", amino: "Trp" },
    { bases: "T G C", color: "#00e599", amino: "Cys" },
  ];
  return (
    <div className="slide-codons">
      {codons.map((c, i) => (
        <div key={i} className="slide-codon" style={{ animationDelay: `${i * 0.15}s` }}>
          <span className="slide-codon-bases" style={{ color: c.color }}>{c.bases}</span>
          <span className="slide-codon-arrow">&darr;</span>
          <span className="slide-codon-amino" style={{ background: c.color }}>{c.amino}</span>
        </div>
      ))}
    </div>
  );
}

function BlockchainVisual() {
  return (
    <div className="slide-blocks">
      {["#1", "#2", "#3", "…", "#1M", "#2M", "#∞"].map((lbl, i) => (
        <div key={i} className={`slide-block ${i >= 4 ? "heavy" : ""}`}>{lbl}</div>
      ))}
    </div>
  );
}

function TelomereVisual() {
  return (
    <div className="slide-telo">
      <div className="slide-telo-bar">
        <div className="slide-telo-end left">TTAGGG</div>
        <div className="slide-telo-body">21,000,000 coins</div>
        <div className="slide-telo-end right">TTAGGG</div>
      </div>
    </div>
  );
}

function GelVisual() {
  const lanes = [
    { label: "Network", color: "#8b5cf6", positions: [15, 30, 50, 70, 85], match: true },
    { label: "Coin", color: "#00e599", positions: [15, 30, 50, 70, 85], match: true },
    { label: "Forged", color: "#ef4444", positions: [10, 25, 60], match: false },
  ];
  return (
    <div className="slide-gel">
      {lanes.map((lane, li) => (
        <div key={li} className="slide-gel-lane">
          <div className="slide-gel-label" style={{ color: lane.color }}>{lane.label}</div>
          <div className="slide-gel-track">
            {lane.positions.map((p, bi) => (
              <div key={bi} className="slide-gel-band" style={{ top: `${p}%`, background: lane.color, animationDelay: `${bi * 0.12}s` }} />
            ))}
          </div>
          <div className={`slide-gel-result ${lane.match ? "" : "fail"}`}>{lane.match ? "✓ MATCH" : "✗ NO MATCH"}</div>
        </div>
      ))}
    </div>
  );
}

function ShieldsVisual() {
  const shields = [
    { n: "1", label: "SHA-256 Proof-of-Work", sub: "Same algorithm as Bitcoin", color: "#d29922" },
    { n: "2", label: "Ed25519 Signatures", sub: "Same crypto as Solana & Signal", color: "var(--secondary)" },
    { n: "3", label: "RFLP Bio-Fingerprinting", sub: "DNA paternity test", color: "#8b5cf6" },
    { n: "4", label: "Cryptographic Nullifiers", sub: "No double-spending", color: "#f85149" },
  ];
  return (
    <div className="slide-shields">
      {shields.map((s, i) => (
        <div key={i} className="slide-shield" style={{ borderColor: s.color, animationDelay: `${i * 0.12}s` }}>
          <div className="slide-shield-num" style={{ background: s.color }}>{s.n}</div>
          <div><strong>{s.label}</strong><br /><span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{s.sub}</span></div>
        </div>
      ))}
    </div>
  );
}

function MrnaVisual() {
  return (
    <div className="slide-mrna">
      <span className="slide-mrna-icon">{"\uD83E\uDDEC"}</span>
      <span className="slide-mrna-arrow">&rarr;</span>
      <div className="slide-mrna-envelope">
        <span>{"\uD83D\uDCE7"}</span>
        <small>mRNA Payload</small>
        <span className="slide-mrna-stamp">Ed25519 &bull; RFLP &bull; PoW</span>
      </div>
      <span className="slide-mrna-arrow">&rarr;</span>
      <span className="slide-mrna-icon">{"\uD83E\uDDEC"}</span>
    </div>
  );
}

function CodeVisual() {
  return (
    <div className="slide-code">
      <pre>{`import { ZcoinPay } from '@zcoin/gateway';

const pay = new ZcoinPay({ network: 'zcoin.bio' });

pay.checkout({ amount: 10, label: 'Premium' })
   .then(r => console.log('Paid!', r));`}</pre>
    </div>
  );
}

function PersonaVisual() {
  const personas = [
    { emoji: "⛏", label: "Miners", desc: "Open a tab, earn coins" },
    { emoji: "🛒", label: "Merchants", desc: "5 lines of code, zero fees" },
    { emoji: "👩‍💻", label: "Developers", desc: "Build on the SDK" },
    { emoji: "🌍", label: "Everyone", desc: "No bank, no ID needed" },
  ];
  return (
    <div className="slide-personas">
      {personas.map((p, i) => (
        <div key={i} className="slide-persona">
          <span className="slide-persona-emoji">{p.emoji}</span>
          <strong>{p.label}</strong>
          <span>{p.desc}</span>
        </div>
      ))}
    </div>
  );
}

function EconomyVisual() {
  const features = [
    { icon: "💰", label: "Earn by Mining" },
    { icon: "🔒", label: "Own Your Keys" },
    { icon: "⚡", label: "Instant & Free" },
    { icon: "🧬", label: "Bio-Unique" },
    { icon: "📡", label: "Works Offline" },
    { icon: "🌐", label: "Open Source" },
  ];
  return (
    <div className="slide-economy">
      {features.map((f, i) => (
        <div key={i} className="slide-eco-item">
          <span>{f.icon}</span>
          <span>{f.label}</span>
        </div>
      ))}
    </div>
  );
}

function EarlyAdopterVisual() {
  return (
    <div className="slide-early">
      <div className="slide-era">
        <span className="slide-era-icon">{"\uD83C\uDFC1"}</span>
        <strong style={{ color: "var(--primary)" }}>NOW</strong>
        <span>50 coins / block</span>
      </div>
      <span className="slide-era-arrow">&rarr;</span>
      <div className="slide-era">
        <span className="slide-era-icon">{"\uD83D\uDCC8"}</span>
        <strong style={{ color: "#d29922" }}>LATER</strong>
        <span>25 coins / block</span>
      </div>
      <span className="slide-era-arrow">&rarr;</span>
      <div className="slide-era">
        <span className="slide-era-icon">{"\uD83D\uDD12"}</span>
        <strong style={{ color: "#f85149" }}>FINAL</strong>
        <span>0 coins / block</span>
      </div>
    </div>
  );
}

/* ─── Live ticker ───────────────────────────────────────────────────────── */

function Ticker({ stats }: { stats: NetworkStats | null }) {
  if (!stats) return null;
  return (
    <div className="ticker">
      <div className="ticker-inner">
        <span className="pulse-dot" /> <span className="ticker-live">Live</span>
        <span className="sep">&middot;</span>
        <span>Coins: <b className="text-primary">{stats.totalCoins}</b></span>
        <span className="sep">&middot;</span>
        <span>Miners: <b>{stats.totalWallets}</b></span>
        <span className="sep">&middot;</span>
        <span>Difficulty: <b className="mono">{stats.difficulty.length} zeros</b></span>
        <span className="sep">&middot;</span>
        <span>Submissions: <b>{stats.totalSubmissions}</b></span>
        <span className="sep">&middot;</span>
        <span>Nullifiers: <b>{stats.nullifiers}</b></span>
      </div>
    </div>
  );
}

/* ─── Why zcoin? ────────────────────────────────────────────────────────── */

function WhySection() {
  const r = useReveal();
  const px = useParallax();
  const cards = [
    { icon: "&#x1F9EC;", title: "Mine in your browser", desc: "No GPU rigs, no electricity bills. Open a tab and your browser's CPU does the work. Anyone with a web browser can earn coins." },
    { icon: "&#x26D3;&#xFE0F;", title: "No blockchain", desc: "Faster, lighter, more private. Nullifier-based double-spend prevention, duplicate serial tracking, and Ed25519 verification \u2014 no chain, no blocks." },
    { icon: "&#x1F510;", title: "Ed25519 + SHA-256 + RFLP", desc: "Ed25519 asymmetric signatures, SHA-256 proof-of-work, and biological RFLP fingerprinting. Three independent layers — mathematical, computational, and biological. 259 bits of protein entropy per coin." },
    { icon: "&#x1F4E1;", title: "Offline everything", desc: "Transfer and verify coins without internet. Every wallet carries the Network Genome to validate Ed25519 signatures offline. RFLP parentage tests work anywhere. True peer-to-peer, even without servers." },
    { icon: "&#x1F52C;", title: "DNA-encoded value", desc: "Every coin is a gene sequence. Every wallet is a DNA strand. Coins carry inherited restriction enzyme markers — a biological fingerprint proving parentage, just like a DNA paternity test." },
    { icon: "&#x1F680;", title: "Build your own", desc: "Fork the network, create your own coin with custom DNA. Our TypeScript SDK makes it trivial to launch a new biological token." },
  ];
  return (
    <section className="section parallax-section" id="why" ref={px}>
      <SideHelix side="right" top="5%" />
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Why zBioCoin?</span>
          <h2 className="section-title">Cryptocurrency <span className="grad-text">reimagined</span></h2>
          <p className="section-sub">
            We didn't just create another token. We built a new paradigm where
            money behaves like living organisms.
          </p>
        </div>
        <div className="why-grid">
          {cards.map((c, i) => (
            <div key={i} className="why-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="why-icon" dangerouslySetInnerHTML={{ __html: c.icon }} />
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Gel Electrophoresis Interactive Animation ────────────────────────── */

const GEL_ENZYMES = [
  { name: "EcoRI", site: "GAATTC", color: "#ef4444" },
  { name: "BamHI", site: "GGATCC", color: "#f59e0b" },
  { name: "HindIII", site: "AAGCTT", color: "#3b82f6" },
  { name: "PstI", site: "CTGCAG", color: "#8b5cf6" },
  { name: "SalI", site: "GTCGAC", color: "#00e599" },
];

const MARKER_DNA =
  "TACGGATCCAGTCAAGCTTGCATGAATTCGTAGTCGACCTGCAGATTGGATCCAACGAATTCTTAAGCTTGCCTGCAGATCGTCGACAAT" +
  "GGATCCGAGAATTCCTGCAGTTAAAGCTTGCGTCGACCGATGGATCCTTGAATTCAAGCTTCTGCAGTCGTCGACGAATTCGGATCCTAA" +
  "GCTTCTGCAGGTCGACTATGGATCCAAAGCTTCGAATTCAGTCGACCTGCAGTTGGATCCGAATTCAAGCTTGTCGACTCTGCAGGATCC" +
  "GCTTAAGCTTGAATTCGTCGACCTGCAGGGATCCAAGCTTGAATTCTCGTCGACCTGCAGATGGATCCTTAAGCTTGCGAATTCGTCGAC";

function buildGelData() {
  const cuts: { pos: number; enzyme: typeof GEL_ENZYMES[number] }[] = [];
  for (const enz of GEL_ENZYMES) {
    let idx = 0;
    while (idx <= MARKER_DNA.length - enz.site.length) {
      if (MARKER_DNA.slice(idx, idx + enz.site.length) === enz.site) {
        cuts.push({ pos: idx + 1, enzyme: enz });
        idx += enz.site.length;
      } else idx++;
    }
  }
  cuts.sort((a, b) => a.pos - b.pos);
  const positions = [0, ...cuts.map(c => c.pos), MARKER_DNA.length];
  const frags: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    const len = positions[i] - positions[i - 1];
    if (len > 0) frags.push(len);
  }
  frags.sort((a, b) => b - a);

  const forged = [68, 41, 29, 17, 9, 52, 5, 33];
  forged.sort((a, b) => b - a);

  return { cuts, frags, forged };
}

const GEL_DATA = buildGelData();

const _easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const _easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const _clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const _lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const _logY = (frag: number, maxFrag: number, top: number, bot: number) => {
  const ratio = frag / maxFrag;
  const pos = 1 - ratio * ratio;
  return top + pos * (bot - top);
};

function GelElectrophoresisSection() {
  const r = useReveal();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const ANIM_DURATION = 30000;
  const HOLD_DURATION = 12000;
  const CYCLE = ANIM_DURATION + HOLD_DURATION;

  const drawGel = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (sizeRef.current.w !== rect.width || sizeRef.current.h !== rect.height) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: rect.width, h: rect.height };
    }
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const cycleElapsed = now % CYCLE;
    const globalT = _clamp01(cycleElapsed / ANIM_DURATION);

    const tDna       = _clamp01(globalT / 0.18);
    const tScan      = _clamp01((globalT - 0.10) / 0.22);
    const tCut       = _clamp01((globalT - 0.28) / 0.10);
    const tDnaFade   = _clamp01((globalT - 0.36) / 0.08);
    const tGelIn     = _clamp01((globalT - 0.38) / 0.08);
    const tMigrate   = _clamp01((globalT - 0.42) / 0.30);
    const tLines     = _clamp01((globalT - 0.68) / 0.10);
    const tVerdict   = _clamp01((globalT - 0.76) / 0.10);

    const dnaAlpha = 1 - _easeInOut(tDnaFade);
    const gelAlpha = _easeInOut(tGelIn);

    const { cuts, frags, forged } = GEL_DATA;
    const maxFrag = Math.max(...frags);

    // ──── DNA STRAND ────
    if (dnaAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = dnaAlpha;

      const dnaY = H * 0.38;
      const dnaX0 = W * 0.04;
      const dnaX1 = W * 0.96;
      const dnaW = dnaX1 - dnaX0;
      const waveT = now * 0.001;
      const amplitude = 16;

      // Backbone strands
      for (let strand = 0; strand < 2; strand++) {
        const phase = strand * Math.PI;
        const col = strand === 0 ? "rgba(0,229,153,0.55)" : "rgba(139,92,246,0.45)";
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= dnaW; px += 1) {
          const frac = px / dnaW;
          const y = dnaY + Math.sin(frac * Math.PI * 10 + waveT + phase) * amplitude;
          if (px === 0) ctx.moveTo(dnaX0 + px, y); else ctx.lineTo(dnaX0 + px, y);
        }
        ctx.stroke();
      }

      // Base pair rungs
      const rungCount = 70;
      for (let i = 0; i < rungCount; i++) {
        const frac = (i + 0.5) / rungCount;
        const x = dnaX0 + frac * dnaW;
        const y1 = dnaY + Math.sin(frac * Math.PI * 10 + waveT) * amplitude;
        const y2 = dnaY + Math.sin(frac * Math.PI * 10 + waveT + Math.PI) * amplitude;
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
      }

      // Base letters
      const baseColors: Record<string, string> = { T: "#ef4444", A: "#f59e0b", C: "#3b82f6", G: "#00e599" };
      const visibleBases = Math.min(MARKER_DNA.length, 120);
      ctx.font = `bold ${W > 600 ? 9 : 7}px monospace`;
      ctx.textAlign = "center";
      for (let i = 0; i < visibleBases; i++) {
        const revealT = _clamp01(tDna * visibleBases / (i + 1));
        if (revealT < 0.3) continue;
        const frac = i / visibleBases;
        const x = dnaX0 + frac * dnaW;
        const yOff = Math.sin(frac * Math.PI * 10 + waveT) * amplitude;
        ctx.fillStyle = baseColors[MARKER_DNA[i]] || "#444";
        ctx.globalAlpha = dnaAlpha * Math.min(1, revealT) * 0.7;
        ctx.fillText(MARKER_DNA[i], x, dnaY + yOff - 12);
      }
      ctx.globalAlpha = dnaAlpha;

      // Enzyme recognition site highlights
      const revealedCuts = Math.floor(_easeInOut(tScan) * cuts.length);
      for (let si = 0; si < revealedCuts; si++) {
        const site = cuts[si];
        const siteLen = site.enzyme.site.length;
        const startFrac = site.pos / MARKER_DNA.length;
        const endFrac = (site.pos + siteLen) / MARKER_DNA.length;
        const sx = dnaX0 + startFrac * dnaW;
        const ex = dnaX0 + endFrac * dnaW;
        const midX = (sx + ex) / 2;

        // Highlight rectangle behind the site
        const hy1 = dnaY + Math.sin(startFrac * Math.PI * 10 + waveT) * amplitude;
        const hy2 = dnaY + Math.sin(startFrac * Math.PI * 10 + waveT + Math.PI) * amplitude;
        const minHy = Math.min(hy1, hy2) - 4;
        const maxHy = Math.max(hy1, hy2) + 4;
        ctx.fillStyle = site.enzyme.color + "18";
        ctx.beginPath();
        ctx.roundRect(sx - 2, minHy, ex - sx + 4, maxHy - minHy, 3);
        ctx.fill();

        // Cut line
        const cutAlpha = _easeInOut(_clamp01((tCut * cuts.length - si) / 1.5));
        if (cutAlpha > 0) {
          ctx.strokeStyle = site.enzyme.color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = dnaAlpha * cutAlpha;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(midX, minHy - 10); ctx.lineTo(midX, maxHy + 10); ctx.stroke();
          ctx.setLineDash([]);

          // Enzyme label
          ctx.font = `bold ${W > 600 ? 9 : 7}px sans-serif`;
          ctx.fillStyle = site.enzyme.color;
          ctx.textAlign = "center";
          ctx.fillText(site.enzyme.name, midX, dnaY + amplitude + 28 + (si % 3) * 13);

          // Scissors
          if (cutAlpha > 0.5) {
            ctx.font = `${W > 600 ? 14 : 11}px sans-serif`;
            ctx.fillText("✂", midX, minHy - 14);
          }
          ctx.globalAlpha = dnaAlpha;
        }
      }

      // Fragment count
      if (tCut > 0.5) {
        ctx.globalAlpha = dnaAlpha * _clamp01((tCut - 0.5) * 3);
        ctx.font = `bold ${W > 600 ? 12 : 10}px monospace`;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.textAlign = "center";
        ctx.fillText(`${cuts.length} restriction sites → ${frags.length} fragments`, W / 2, H * 0.78);
      }

      ctx.restore();
    }

    // ──── GEL ELECTROPHORESIS ────
    if (gelAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = gelAlpha;

      const pad = W > 600 ? 40 : 20;
      const gelX = pad;
      const gelW = W - pad * 2;
      const gelTop = 40;
      const gelBot = H - 65;
      const gelH = gelBot - gelTop;

      // Gel background gradient
      const gelGrad = ctx.createLinearGradient(0, gelTop, 0, gelBot);
      gelGrad.addColorStop(0, "rgba(10,14,20,0.95)");
      gelGrad.addColorStop(1, "rgba(17,24,39,0.95)");
      ctx.fillStyle = gelGrad;
      ctx.beginPath();
      ctx.roundRect(gelX, gelTop, gelW, gelH, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Size ladder on left
      const ladderW = W > 600 ? 36 : 24;
      const DEFAULT_LADDER = [200, 150, 100, 75, 50, 40, 30, 20, 15, 10, 5];
      ctx.font = `${W > 600 ? 8 : 6}px monospace`;
      ctx.textAlign = "right";
      for (const sz of DEFAULT_LADDER) {
        if (sz > maxFrag * 1.1) continue;
        const y = _logY(sz, maxFrag, gelTop + 12, gelBot - 12);
        ctx.fillStyle = "rgba(100,116,139,0.35)";
        ctx.fillRect(gelX + 4, y - 1, ladderW - 10, 2);
        ctx.fillStyle = "rgba(100,116,139,0.4)";
        ctx.fillText(String(sz), gelX + ladderW - 2, y + 3);
      }

      // Lanes
      const laneLabels = [
        { label: "Network", color: "#a855f7" },
        { label: "Coin #1", color: "#22c55e" },
        { label: "Coin #2", color: "#22c55e" },
        { label: "Coin #3", color: "#38bdf8" },
        { label: "Forged", color: "#ef4444" },
      ];
      const laneData: number[][] = [frags, frags, frags, frags, forged];
      const numLanes = laneLabels.length;
      const laneArea = gelW - ladderW - 12;
      const laneW = laneArea / numLanes;
      const laneXStart = gelX + ladderW + 6;

      const migrateEase = _easeInOut(tMigrate);

      for (let li = 0; li < numLanes; li++) {
        const lx = laneXStart + li * laneW + laneW / 2;
        const lane = laneLabels[li];
        const bands = laneData[li];

        // Lane background
        ctx.fillStyle = "rgba(255,255,255,0.015)";
        ctx.fillRect(laneXStart + li * laneW + 2, gelTop, laneW - 4, gelH);

        // Well at top
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(lx - 12, gelTop, 24, 6);

        // Lane header
        ctx.font = `bold ${W > 600 ? 11 : 8}px sans-serif`;
        ctx.fillStyle = lane.color;
        ctx.textAlign = "center";
        ctx.fillText(lane.label, lx, gelTop - 8);

        // Bands
        const bandW = Math.max(8, laneW - 14);
        for (let bi = 0; bi < bands.length; bi++) {
          const frag = bands[bi];
          const targetY = _logY(frag, maxFrag, gelTop + 12, gelBot - 12);
          const currentY = _lerp(gelTop + 8, targetY, migrateEase);

          const normSize = frag / maxFrag;
          const bandH = Math.max(2, 2 + normSize * 4);
          const intensity = 0.35 + normSize * 0.55;

          // Glow
          ctx.fillStyle = lane.color;
          ctx.globalAlpha = gelAlpha * intensity * migrateEase * 0.3;
          ctx.shadowColor = lane.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.roundRect(lx - bandW / 2, currentY - bandH / 2 - 1, bandW, bandH + 2, 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Band
          ctx.globalAlpha = gelAlpha * intensity * Math.min(1, migrateEase * 1.5);
          ctx.beginPath();
          ctx.roundRect(lx - bandW / 2, currentY - bandH / 2, bandW, bandH, 1.5);
          ctx.fill();

          // Size label on hover zone (always show for first lane)
          if (li === 0 && migrateEase > 0.8 && W > 500) {
            ctx.globalAlpha = gelAlpha * 0.3 * _clamp01((migrateEase - 0.8) * 5);
            ctx.font = "6px monospace";
            ctx.fillStyle = "rgba(168,85,247,0.6)";
            ctx.textAlign = "left";
            ctx.fillText(String(frag) + "bp", lx + bandW / 2 + 3, currentY + 3);
          }
          ctx.globalAlpha = gelAlpha;
        }

        // Comparison lines from network to genuine coin lanes
        if (li >= 1 && li <= 3 && tLines > 0) {
          ctx.globalAlpha = gelAlpha * _easeInOut(tLines) * 0.25;
          ctx.strokeStyle = lane.color;
          ctx.setLineDash([2, 3]);
          ctx.lineWidth = 0.8;
          const netLx = laneXStart + laneW / 2;
          for (const frag of frags) {
            const y = _logY(frag, maxFrag, gelTop + 12, gelBot - 12);
            ctx.beginPath();
            ctx.moveTo(netLx + bandW / 2 + 2, y);
            ctx.lineTo(lx - bandW / 2 - 2, y);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.globalAlpha = gelAlpha;
        }

        // Verdict
        if (tVerdict > 0) {
          ctx.globalAlpha = gelAlpha * _easeInOut(tVerdict);
          ctx.font = `bold ${W > 600 ? 13 : 10}px sans-serif`;
          ctx.textAlign = "center";
          if (li === 0) {
            ctx.fillStyle = "#a855f7";
            ctx.fillText("PARENT", lx, gelBot + 20);
          } else if (li <= 3) {
            ctx.fillStyle = "#22c55e";
            ctx.fillText("✓ MATCH", lx, gelBot + 20);
            ctx.font = `${W > 600 ? 9 : 7}px sans-serif`;
            ctx.fillStyle = "rgba(34,197,94,0.6)";
            ctx.fillText("Bands align", lx, gelBot + 33);
          } else {
            ctx.fillStyle = "#ef4444";
            ctx.fillText("✗ REJECT", lx, gelBot + 20);
            ctx.font = `${W > 600 ? 9 : 7}px sans-serif`;
            ctx.fillStyle = "rgba(239,68,68,0.6)";
            ctx.fillText("Wrong pattern", lx, gelBot + 33);
          }
          ctx.globalAlpha = gelAlpha;
        }
      }

      // Electric field polarity labels
      ctx.globalAlpha = gelAlpha * 0.4;
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "left";
      ctx.fillText("⊖ (−) cathode", gelX + 4, gelTop - 20);
      ctx.fillStyle = "#22c55e";
      ctx.fillText("⊕ (+) anode", gelX + 4, gelBot + 48);

      ctx.restore();
    }

    setProgress(globalT);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let running = true;
    const loop = (now: number) => {
      if (!running) return;
      drawGel(now);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [visible, drawGel]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    const el = canvasRef.current?.parentElement;
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stepLabels = [
    { at: 0,    label: "Marker DNA generated from network private key" },
    { at: 0.12, label: "Restriction enzymes scan for recognition sites" },
    { at: 0.30, label: `Enzymes cut at ${GEL_DATA.cuts.length} sites → ${GEL_DATA.frags.length} fragments` },
    { at: 0.42, label: "Fragments migrate through gel — smaller = faster" },
    { at: 0.70, label: "Compare band patterns across lanes" },
    { at: 0.78, label: "Genuine coins match network pattern; forgeries don't" },
  ];

  return (
    <section className="section gel-section" id="electrophoresis">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Biological Verification</span>
          <h2 className="section-title">
            Gel Electrophoresis &mdash; <span className="grad-text">Coin Paternity Test</span>
          </h2>
          <p className="section-sub">
            Every signed coin carries parentage marker DNA from the network. Five restriction
            enzymes cut it at specific recognition sequences, producing {GEL_DATA.frags.length} fragments
            with a unique band pattern &mdash; a visual fingerprint that proves the coin was
            born from this network. Works completely offline.
          </p>
        </div>
        <div className="gel-anim-wrap">
          <canvas ref={canvasRef} className="gel-canvas" />
          <div className="gel-progress-track">
            <div className="gel-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="gel-step-bar">
            {stepLabels.map((s, i) => {
              const active = progress >= s.at;
              const current = active && (i === stepLabels.length - 1 || progress < stepLabels[i + 1].at);
              return (
                <div key={i} className={`gel-step ${active ? "active" : ""} ${current ? "current" : ""}`}>
                  <div className="gel-step-dot" />
                  <span>{s.label}</span>
                </div>
              );
            })}
          </div>
          <div className="gel-enzyme-legend">
            {GEL_ENZYMES.map(e => (
              <span key={e.name} className="gel-enzyme-pill" style={{ borderColor: e.color, color: e.color }}>
                {e.name} <span className="gel-enzyme-site">{e.site}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Detailed Flow Animation ──────────────────────────────────────────── */

interface FlowStep {
  id: string;
  icon: string;
  label: string;
  title: string;
  desc: string;
  color: string;
}

const FLOW_STEPS: FlowStep[] = [
  {
    id: "wallet", icon: "🧬", label: "01", title: "Create Wallet",
    desc: "One click generates a 6,000-base DNA strand. An Ed25519 keypair is encoded as DNA. The network's public genome is embedded so you can verify coins offline forever.",
    color: "#00e599",
  },
  {
    id: "mine", icon: "⛏", label: "02", title: "Mine a Coin",
    desc: "A Web Worker brute-forces SHA-256 hashes on a random 180-base gene sequence until the hash meets the difficulty target. Same proof-of-work as Bitcoin — running in your browser.",
    color: "#3b82f6",
  },
  {
    id: "sign", icon: "✍️", label: "03", title: "Network Signing",
    desc: "The network verifies your proof-of-work, then signs the coin with its Ed25519 private key and generates an RFLP fingerprint — a unique restriction enzyme gel-band pattern proving parentage.",
    color: "#a855f7",
  },
  {
    id: "integrate", icon: "🧪", label: "04", title: "Coin Integration",
    desc: "The signed coin gene is spliced into your wallet's DNA via biological mutation. Your wallet now physically contains the coin — it's part of your DNA, not a balance in a database.",
    color: "#d29922",
  },
  {
    id: "transfer", icon: "📧", label: "05", title: "Transfer via mRNA",
    desc: "To send a coin, an mRNA payload is created containing the gene, Ed25519 signature, RFLP fingerprint, and proof-of-work. The coin is excised from your DNA. Send via email, USB, QR, or Bluetooth.",
    color: "#f59e0b",
  },
  {
    id: "receive", icon: "📥", label: "06", title: "Receive & Verify",
    desc: "The recipient verifies the Ed25519 signature against the embedded Network Genome, runs the RFLP gel-band check, and confirms the nullifier hasn't been spent — all offline. Then the coin gene integrates into their DNA.",
    color: "#22c55e",
  },
  {
    id: "gateway", icon: "💳", label: "07", title: "Payment Gateway",
    desc: "Merchants add one script tag. Customer clicks 'Pay with zBioCoin', a popup opens on zcoin.bio, they approve the transfer with their private key, and the mRNA is sent. Verified instantly. No 3% fee. No chargebacks.",
    color: "#38bdf8",
  },
];

function FlowAnimation() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const STEP_DURATION = 8000;
  const STEP_HOLD = 6000;
  const STEP_CYCLE = STEP_DURATION + STEP_HOLD;
  const FULL_CYCLE = STEP_CYCLE * FLOW_STEPS.length;

  const drawFlow = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (sizeRef.current.w !== rect.width || sizeRef.current.h !== rect.height) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: rect.width, h: rect.height };
    }
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const cyclePos = now % FULL_CYCLE;
    const step = Math.min(FLOW_STEPS.length - 1, Math.floor(cyclePos / STEP_CYCLE));
    const stepElapsed = cyclePos - step * STEP_CYCLE;
    const stepT = _clamp01(stepElapsed / STEP_DURATION);
    setActiveStep(step);

    const cx = W / 2;
    const cy = H / 2;
    const waveT = now * 0.001;
    const small = W < 500;
    const baseFont = small ? 8 : 10;

    // Background grid
    ctx.strokeStyle = "rgba(0,229,153,0.015)";
    ctx.lineWidth = 0.5;
    const gridSize = 40;
    for (let x = 0; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Central glow
    const stepColor = FLOW_STEPS[step].color;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.45);
    grad.addColorStop(0, stepColor + "12");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── STEP 0: WALLET CREATION ──
    if (step === 0) {
      const t = _easeOut(stepT);
      // DNA helix forming
      const helixCx = cx;
      const helixCy = cy;
      const numRungs = Math.floor(t * 24);
      for (let i = 0; i < numRungs; i++) {
        const frac = i / 24;
        const y = helixCy - 100 + frac * 200;
        const spread = Math.sin(frac * Math.PI * 5 + waveT) * (30 + t * 20);
        const x1 = helixCx - spread;
        const x2 = helixCx + spread;

        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();

        ctx.fillStyle = "#00e599";
        ctx.globalAlpha = 0.7 * t;
        ctx.beginPath(); ctx.arc(x1, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#a855f7";
        ctx.beginPath(); ctx.arc(x2, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Key label
      if (t > 0.5) {
        ctx.globalAlpha = _clamp01((t - 0.5) * 2);
        ctx.font = `bold ${baseFont + 2}px monospace`;
        ctx.fillStyle = "#00e599";
        ctx.textAlign = "center";
        ctx.fillText("Ed25519 keypair → DNA", cx, cy + 130);
        ctx.font = `${baseFont}px monospace`;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillText("6,000 bases · Network Genome embedded", cx, cy + 148);
        ctx.globalAlpha = 1;
      }
    }

    // ── STEP 1: MINING ──
    if (step === 1) {
      const t = stepT;
      // Hash computation visualization
      const hashY = cy - 60;
      const numHashes = Math.floor(_easeOut(t) * 16);

      for (let i = 0; i < numHashes; i++) {
        const y = hashY + i * 18;
        const alpha = i === numHashes - 1 && t > 0.8 ? 1 : 0.25;
        const isMatch = i === numHashes - 1 && t > 0.85;

        ctx.font = `${baseFont}px monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = isMatch ? "#22c55e" : "rgba(255,255,255,0.3)";
        ctx.globalAlpha = alpha;

        const prefix = isMatch ? "0000000000" : "4f" + String(i * 3 + 7).padStart(8, "a");
        const rest = isMatch ? "a7c3e1..." : String(Math.floor(Math.random() * 9999)).padStart(4, "0") + "...";
        ctx.fillText(`SHA-256(gene|nonce=${1247 + i * 389}) = ${prefix}${rest}`, cx, y);
        ctx.globalAlpha = 1;
      }

      if (t > 0.85) {
        ctx.globalAlpha = _clamp01((t - 0.85) * 6);
        ctx.font = `bold ${baseFont + 4}px sans-serif`;
        ctx.fillStyle = "#22c55e";
        ctx.textAlign = "center";
        ctx.fillText("✓ COIN FOUND", cx, hashY + numHashes * 18 + 28);
        ctx.font = `${baseFont}px monospace`;
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText("Hash below difficulty target — proof-of-work complete", cx, hashY + numHashes * 18 + 46);
        ctx.globalAlpha = 1;
      }
    }

    // ── STEP 2: NETWORK SIGNING ──
    if (step === 2) {
      const t = _easeInOut(stepT);

      // Coin travels to network
      const coinX = cx - 140 + t * 100;
      const netX = cx + 80;

      // Coin circle
      ctx.beginPath();
      ctx.arc(coinX, cy - 20, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f620";
      ctx.fill();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `bold ${baseFont + 2}px sans-serif`;
      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "center";
      ctx.fillText("COIN", coinX, cy - 16);

      // Arrow
      if (t > 0.2) {
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(coinX + 28, cy - 20); ctx.lineTo(netX - 30, cy - 20); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Network node
      ctx.beginPath();
      ctx.arc(netX, cy - 20, 30, 0, Math.PI * 2);
      ctx.fillStyle = "#a855f720";
      ctx.fill();
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `bold ${baseFont}px sans-serif`;
      ctx.fillStyle = "#a855f7";
      ctx.fillText("NETWORK", netX, cy - 24);
      ctx.font = `${baseFont - 1}px sans-serif`;
      ctx.fillText("Ed25519", netX, cy - 12);

      // Signature + RFLP appearing
      if (t > 0.5) {
        const sigT = _clamp01((t - 0.5) * 2);
        ctx.globalAlpha = _easeOut(sigT);

        ctx.font = `bold ${baseFont + 1}px monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#a855f7";
        ctx.fillText("✓ Ed25519 Signature applied", cx, cy + 40);

        if (sigT > 0.4) {
          ctx.fillStyle = "#8b5cf6";
          ctx.fillText("✓ RFLP Fingerprint generated", cx, cy + 58);
        }

        // Gel mini-visualization
        if (sigT > 0.6) {
          const gelX = cx - 50;
          const gelW = 100;
          const gelY = cy + 72;
          const gelH = 60;
          ctx.fillStyle = "rgba(139,92,246,0.06)";
          ctx.strokeStyle = "rgba(139,92,246,0.2)";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(gelX, gelY, gelW, gelH, 4); ctx.fill(); ctx.stroke();

          const bandPositions = [0.12, 0.22, 0.35, 0.42, 0.55, 0.65, 0.72, 0.82, 0.9];
          for (const bp of bandPositions) {
            const by = gelY + bp * gelH;
            const bandAlpha = _easeOut(_clamp01((sigT - 0.6) * 3));
            ctx.fillStyle = "#a855f7";
            ctx.globalAlpha = bandAlpha * 0.7;
            ctx.shadowColor = "#a855f7";
            ctx.shadowBlur = 4;
            ctx.fillRect(gelX + 8, by - 1.5, gelW - 16, 3);
            ctx.shadowBlur = 0;
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // ── STEP 3: COIN INTEGRATION ──
    if (step === 3) {
      const t = _easeInOut(stepT);

      // Wallet DNA strand
      const dnaY = cy;
      const dnaX0 = cx - 160;
      const dnaX1 = cx + 160;
      const dnaW = dnaX1 - dnaX0;

      for (let strand = 0; strand < 2; strand++) {
        const phase = strand * Math.PI;
        ctx.strokeStyle = strand === 0 ? "rgba(0,229,153,0.4)" : "rgba(139,92,246,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let px = 0; px <= dnaW; px += 2) {
          const frac = px / dnaW;
          const y = dnaY + Math.sin(frac * Math.PI * 6 + waveT + phase) * 14;
          if (px === 0) ctx.moveTo(dnaX0 + px, y); else ctx.lineTo(dnaX0 + px, y);
        }
        ctx.stroke();
      }

      // Coin gene splicing in
      const geneW = 40;
      const geneX = cx - geneW / 2;
      const geneTargetY = dnaY;
      const geneStartY = dnaY - 80;
      const geneY = geneStartY + (geneTargetY - geneStartY) * t;

      ctx.fillStyle = "#d2992230";
      ctx.strokeStyle = "#d29922";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(geneX, geneY - 10, geneW, 20, 4); ctx.fill(); ctx.stroke();
      ctx.font = `bold ${baseFont - 1}px monospace`;
      ctx.fillStyle = "#d29922";
      ctx.textAlign = "center";
      ctx.fillText("GENE", cx, geneY + 3);

      // Arrow showing splice
      if (t > 0.3 && t < 0.8) {
        ctx.font = `${baseFont + 8}px sans-serif`;
        ctx.fillStyle = "rgba(210,153,34,0.6)";
        ctx.fillText("↓", cx, geneY + 26);
      }

      // Flash when integrated
      if (t > 0.8) {
        const flashT = _clamp01((t - 0.8) * 5);
        ctx.globalAlpha = (1 - flashT) * 0.3;
        const flashGrad = ctx.createRadialGradient(cx, dnaY, 0, cx, dnaY, 80);
        flashGrad.addColorStop(0, "#d29922");
        flashGrad.addColorStop(1, "transparent");
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;

        ctx.font = `bold ${baseFont + 2}px sans-serif`;
        ctx.fillStyle = "#d29922";
        ctx.textAlign = "center";
        ctx.globalAlpha = _easeOut(flashT);
        ctx.fillText("Coin gene spliced into wallet DNA", cx, cy + 60);
        ctx.globalAlpha = 1;
      }
    }

    // ── STEP 4: TRANSFER ──
    if (step === 4) {
      const t = _easeOut(stepT);

      // Sender DNA
      const senderX = small ? cx - 80 : cx - 160;
      ctx.font = `bold ${baseFont}px sans-serif`;
      ctx.fillStyle = "#f59e0b";
      ctx.textAlign = "center";
      ctx.fillText("Sender", senderX, cy - 70);

      // Mini helix for sender
      for (let i = 0; i < 8; i++) {
        const y = cy - 50 + i * 10;
        const spread = Math.sin(i * 0.8 + waveT) * 15;
        ctx.fillStyle = "#00e59960";
        ctx.beginPath(); ctx.arc(senderX - spread, y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#a855f760";
        ctx.beginPath(); ctx.arc(senderX + spread, y, 3, 0, Math.PI * 2); ctx.fill();
      }

      // Gene excised (gap in sender DNA)
      if (t > 0.2) {
        ctx.strokeStyle = "#ef4444";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(senderX - 10, cy - 20);
        ctx.lineTo(senderX + 10, cy - 20);
        ctx.moveTo(senderX - 10, cy + 10);
        ctx.lineTo(senderX + 10, cy + 10);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // mRNA envelope traveling
      const envStartX = senderX + 40;
      const envEndX = small ? cx + 80 : cx + 100;
      const envX = envStartX + (envEndX - envStartX) * _clamp01((t - 0.2) / 0.6);
      const envY = cy - 10;

      if (t > 0.15) {
        ctx.fillStyle = "rgba(245,158,11,0.08)";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(envX - 36, envY - 22, 72, 44, 8); ctx.fill(); ctx.stroke();

        ctx.font = `bold ${baseFont - 1}px sans-serif`;
        ctx.fillStyle = "#f59e0b";
        ctx.textAlign = "center";
        ctx.fillText("mRNA", envX, envY - 6);
        ctx.font = `${baseFont - 2}px monospace`;
        ctx.fillStyle = "rgba(245,158,11,0.6)";
        ctx.fillText("Gene + Sig + RFLP", envX, envY + 8);
      }

      // Transport method labels
      if (t > 0.6) {
        ctx.globalAlpha = _easeOut(_clamp01((t - 0.6) / 0.3));
        ctx.font = `${baseFont - 1}px sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.textAlign = "center";
        const methods = ["Email", "USB", "QR Code", "Bluetooth"];
        methods.forEach((m, i) => {
          ctx.fillText(m, envX - 48 + i * 32, envY + 36);
        });
        ctx.globalAlpha = 1;
      }
    }

    // ── STEP 5: RECEIVE & VERIFY ──
    if (step === 5) {
      const t = _easeInOut(stepT);

      // Recipient helix
      const recvX = small ? cx + 60 : cx + 100;
      ctx.font = `bold ${baseFont}px sans-serif`;
      ctx.fillStyle = "#22c55e";
      ctx.textAlign = "center";
      ctx.fillText("Recipient", recvX, cy - 70);

      for (let i = 0; i < 8; i++) {
        const y = cy - 50 + i * 10;
        const spread = Math.sin(i * 0.8 + waveT) * 15;
        ctx.fillStyle = "#00e59960";
        ctx.beginPath(); ctx.arc(recvX - spread, y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#a855f760";
        ctx.beginPath(); ctx.arc(recvX + spread, y, 3, 0, Math.PI * 2); ctx.fill();
      }

      // Verification steps appearing
      const checks = [
        { label: "Ed25519 signature ✓", color: "#3b82f6", at: 0.15 },
        { label: "RFLP gel-band match ✓", color: "#a855f7", at: 0.35 },
        { label: "Nullifier not spent ✓", color: "#ef4444", at: 0.50 },
        { label: "Proof-of-work valid ✓", color: "#f59e0b", at: 0.65 },
      ];

      const checkX = small ? cx - 70 : cx - 100;
      for (const chk of checks) {
        if (t < chk.at) continue;
        const alpha = _easeOut(_clamp01((t - chk.at) / 0.15));
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${baseFont}px monospace`;
        ctx.fillStyle = chk.color;
        ctx.textAlign = "left";
        ctx.fillText(chk.label, checkX, cy - 46 + checks.indexOf(chk) * 22);
        ctx.globalAlpha = 1;
      }

      // Integration flash
      if (t > 0.8) {
        ctx.globalAlpha = _easeOut(_clamp01((t - 0.8) / 0.2));
        ctx.font = `bold ${baseFont + 2}px sans-serif`;
        ctx.fillStyle = "#22c55e";
        ctx.textAlign = "center";
        ctx.fillText("ALL VERIFIED — coin integrated into DNA", cx, cy + 60);
        ctx.font = `${baseFont}px monospace`;
        ctx.fillStyle = "rgba(34,197,94,0.5)";
        ctx.fillText("No server needed · Completely offline", cx, cy + 78);
        ctx.globalAlpha = 1;
      }
    }

    // ── STEP 6: PAYMENT GATEWAY ──
    if (step === 6) {
      const t = _easeInOut(stepT);

      // Browser window
      const bw = Math.min(320, W * 0.7);
      const bh = 160;
      const bx = cx - bw / 2;
      const by = cy - bh / 2 - 10;

      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();

      // Browser chrome
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(bx, by, bw, 24);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.moveTo(bx, by + 24); ctx.lineTo(bx + bw, by + 24); ctx.stroke();

      const dotColors = ["#ef4444", "#f59e0b", "#22c55e"];
      dotColors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(bx + 14 + i * 16, by + 12, 4, 0, Math.PI * 2); ctx.fill();
      });

      ctx.font = `${baseFont - 2}px monospace`;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.textAlign = "left";
      ctx.fillText("merchant-shop.com", bx + 68, by + 16);

      // Pay button
      const btnW = 120;
      const btnH = 28;
      const btnX = cx - btnW / 2;
      const btnY = by + 46;
      ctx.fillStyle = "#00e59920";
      ctx.strokeStyle = "#00e599";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.fill(); ctx.stroke();
      ctx.font = `bold ${baseFont}px sans-serif`;
      ctx.fillStyle = "#00e599";
      ctx.textAlign = "center";
      ctx.fillText("Pay with zBioCoin", cx, btnY + 18);

      // Popup appearing
      if (t > 0.25) {
        const popT = _easeOut(_clamp01((t - 0.25) / 0.3));
        const popW = 140;
        const popH = 90;
        const popX = cx - popW / 2;
        const popY = by + 80;

        ctx.globalAlpha = popT;
        ctx.fillStyle = "rgba(6,9,15,0.95)";
        ctx.strokeStyle = "#00e599";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH * popT, 6); ctx.fill(); ctx.stroke();

        if (popT > 0.5) {
          ctx.font = `bold ${baseFont}px sans-serif`;
          ctx.fillStyle = "#00e599";
          ctx.textAlign = "center";
          ctx.fillText("zcoin.bio wallet", cx, popY + 18);

          ctx.font = `${baseFont - 1}px sans-serif`;
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.fillText("Send 5 ZBIO →", cx, popY + 36);

          if (t > 0.6) {
            ctx.fillStyle = "#22c55e";
            ctx.font = `bold ${baseFont}px sans-serif`;
            ctx.fillText("Confirm ✓", cx, popY + 56);
          }
        }
        ctx.globalAlpha = 1;
      }

      // Result
      if (t > 0.75) {
        ctx.globalAlpha = _easeOut(_clamp01((t - 0.75) / 0.2));
        ctx.font = `bold ${baseFont + 3}px sans-serif`;
        ctx.fillStyle = "#22c55e";
        ctx.textAlign = "center";
        ctx.fillText("Payment Complete", cx, by + bh + 50);
        ctx.font = `${baseFont}px sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillText("mRNA transferred · Verified instantly · 0% fee", cx, by + bh + 68);
        ctx.globalAlpha = 1;
      }
    }
  }, [FULL_CYCLE, STEP_CYCLE, STEP_DURATION]);

  useEffect(() => {
    if (!visible) return;
    let running = true;
    const loop = (now: number) => {
      if (!running) return;
      drawFlow(now);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [visible, drawFlow]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    const el = sectionRef.current;
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="section section-alt flow-section" id="flow" ref={sectionRef}>
      <div className="container">
        <div className="section-header">
          <span className="section-tag">The Complete Flow</span>
          <h2 className="section-title">
            From wallet to <span className="grad-text">payment</span> — every step
          </h2>
          <p className="section-sub">
            Watch the entire lifecycle of a zBioCoin — from DNA wallet creation through mining,
            signing, transferring, and spending via the payment gateway.
          </p>
        </div>
        <div className="flow-layout">
          <div className="flow-steps-col">
            {FLOW_STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`flow-step-btn ${activeStep === i ? "active" : ""} ${activeStep > i ? "done" : ""}`}
                style={{ "--fc": s.color } as React.CSSProperties}
              >
                <div className="flow-step-icon">{s.icon}</div>
                <div className="flow-step-info">
                  <div className="flow-step-num" style={{ color: s.color }}>{s.label}</div>
                  <div className="flow-step-title">{s.title}</div>
                  <div className="flow-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flow-canvas-col">
            <canvas ref={canvasRef} className="flow-canvas" />
            <div className="flow-progress">
              {FLOW_STEPS.map((s, i) => (
                <div key={s.id} className={`flow-dot ${activeStep === i ? "active" : ""} ${activeStep > i ? "done" : ""}`}
                  style={{ "--fc": s.color } as React.CSSProperties} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ──────────────────────────────────────────────────────── */

function HowItWorks() {
  const r = useReveal();
  const steps = [
    { n: "01", title: "Create a wallet", desc: "One click generates a 6,000-base DNA strand with a private key. The network\u2019s Ed25519 public key is embedded, letting you verify coins offline forever. No KYC. No signup.", color: "var(--primary)" },
    { n: "02", title: "Mine coins", desc: "Click \u201CStart Mining\u201D and a Web Worker brute-forces SHA-256 hashes until one meets the difficulty target. Real proof-of-work \u2014 same algorithm as Bitcoin \u2014 running in your browser.", color: "var(--secondary)" },
    { n: "03", title: "Get signed + fingerprinted", desc: "The network validates your proof-of-work, signs with Ed25519, and generates a unique RFLP gel-band fingerprint. Two independent proofs travel with every coin for offline verification.", color: "#d29922" },
    { n: "04", title: "Trade & transfer", desc: "Send coins via mRNA payloads \u2014 self-contained files carrying the gene, signature, and fingerprint. Recipients validate everything offline. Email, USB, QR \u2014 your choice.", color: "#f85149" },
  ];
  const px = useParallax();
  return (
    <section className="section section-alt parallax-section" id="how" ref={px}>
      <SideHelix side="left" top="20%" />
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">How it works</span>
          <h2 className="section-title">From DNA to <span className="grad-text">digital gold</span></h2>
        </div>
        <div className="steps">
          {steps.map((s, i) => (
            <div key={i} className="step" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="step-indicator">
                <div className="step-dot" style={{ borderColor: s.color, boxShadow: `0 0 12px ${s.color}44` }} />
                {i < steps.length - 1 && <div className="step-line" />}
              </div>
              <div className="step-n" style={{ color: s.color }}>{s.n}</div>
              <div className="step-body">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <Link to="/mine" className="btn btn-primary btn-lg btn-glow">
            Try it now &mdash; mine your first coin
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Quick Start ──────────────────────────────────────────────────────── */

function QuickStart() {
  const r = useReveal();
  return (
    <section className="section" id="start">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Get Started</span>
          <h2 className="section-title">Start earning in <span className="grad-text">3 steps</span></h2>
          <p className="section-sub">No downloads. No sign-up. No email. Just open your browser.</p>
        </div>
        <div className="qs-steps">
          <div className="qs-card">
            <div className="qs-num">1</div>
            <div className="qs-icon">&#x1F4B3;</div>
            <h3>Create a wallet</h3>
            <p>One click generates a unique 6,000-base DNA strand with the Network Genome embedded. Your private key never leaves your browser.</p>
            <Link to="/wallet" className="btn btn-secondary btn-sm" style={{ marginTop: "auto" }}>Create Wallet</Link>
          </div>
          <div className="qs-arrow">&#x2192;</div>
          <div className="qs-card">
            <div className="qs-num">2</div>
            <div className="qs-icon">&#x26CF;&#xFE0F;</div>
            <h3>Mine coins</h3>
            <p>Hit "Start Mining" and your browser's CPU begins proof-of-work. Coins are found automatically.</p>
            <Link to="/mine" className="btn btn-secondary btn-sm" style={{ marginTop: "auto" }}>Start Mining</Link>
          </div>
          <div className="qs-arrow">&#x2192;</div>
          <div className="qs-card">
            <div className="qs-num">3</div>
            <div className="qs-icon">&#x1F4E8;</div>
            <h3>Send &amp; trade</h3>
            <p>Transfer coins via mRNA files, use them in the marketplace, or accept payments on your site.</p>
            <Link to="/transfer" className="btn btn-secondary btn-sm" style={{ marginTop: "auto" }}>Go to Transfer</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── For Everyone ──────────────────────────────────────────────────────── */

function ForEveryone() {
  const r = useReveal();
  return (
    <section className="section" id="for">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">For everyone</span>
          <h2 className="section-title">Whether you're a <span className="grad-text">trader, developer, or curious newcomer</span></h2>
        </div>
        <div className="persona-grid">
          <div className="persona-card">
            <h3>Miners</h3>
            <p>Earn coins by donating your browser's CPU. No hardware investment. Mine while you browse, earn while you sleep.</p>
            <Link to="/mine" className="btn btn-primary btn-sm">Start Mining</Link>
          </div>
          <div className="persona-card">
            <h3>Traders</h3>
            <p>Transfer coins peer-to-peer with zero fees. Create mRNA payloads offline and hand-deliver value. No exchange needed.</p>
            <Link to="/transfer" className="btn btn-primary btn-sm">Transfer Coins</Link>
          </div>
          <div className="persona-card">
            <h3>Developers</h3>
            <p>Fork our open-source engine. Create custom tokens, build payment integrations, launch your own biological network in minutes.</p>
            <a href="https://github.com/pipikaex/biocoin" target="_blank" rel="noopener" className="btn btn-secondary btn-sm">View Source</a>
          </div>
          <div className="persona-card">
            <h3>Businesses</h3>
            <p>Accept zBioCoin as payment with our drop-in gateway SDK. One script tag, popup checkout &mdash; like PayPal, but decentralized.</p>
            <a href="https://demo.zcoin.bio" target="_blank" rel="noopener" className="btn btn-primary btn-sm">See Demo Marketplace</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Tokenomics ────────────────────────────────────────────────────────── */

function Tokenomics({ stats }: { stats: NetworkStats | null }) {
  const r = useReveal();
  const liveDifficulty = stats?.difficulty ?? "000000";
  const reward = (stats as any)?.currentReward ?? 50;
  const eraName = (stats as any)?.halvingEraName ?? "Genesis";
  const pct = (stats as any)?.telomerePercent ?? 100;
  return (
    <section className="section section-alt" id="tokenomics">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Tokenomics</span>
          <h2 className="section-title">21 million cap. <span className="grad-text">Telomere-enforced scarcity.</span></h2>
          <p className="section-sub">Bitcoin-identical economics with biological hard cap. No pre-mine. No inflation after Hayflick limit.</p>
        </div>
        <div className="tok-grid">
          <div className="tok-card">
            <div className="tok-val">21M</div>
            <div className="tok-lbl">Maximum Supply (Hard Cap)</div>
          </div>
          <div className="tok-card">
            <div className="tok-val">{reward}</div>
            <div className="tok-lbl">Block Reward ({eraName} Era)</div>
          </div>
          <div className="tok-card">
            <div className="tok-val">210K</div>
            <div className="tok-lbl">Halving Interval</div>
          </div>
          <div className="tok-card">
            <div className="tok-val mono">{liveDifficulty}</div>
            <div className="tok-lbl">Current Difficulty ({liveDifficulty.length} zeros)</div>
          </div>
          <div className="tok-card">
            <div className="tok-val">{pct.toFixed(1)}%</div>
            <div className="tok-lbl">Telomere Remaining</div>
          </div>
          <div className="tok-card">
            <div className="tok-val">1%</div>
            <div className="tok-lbl">Transfer Burn Rate</div>
          </div>
        </div>
        <div className="tok-explain">
          <p>
            <b>How value is created:</b> Each coin requires real computational work (SHA-256 PoW). Block rewards start at 50 coins
            and halve every 210,000 submissions — identical to Bitcoin. The network's telomeres (TTAGGG repeats) shorten with each
            mine. When they reach zero, mining stops forever (Hayflick limit). Transfers burn 1% of coins, creating deflationary pressure.
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <Link to="/economics" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Explore the full economics model {"\u2192"}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Security / Defense in Depth ──────────────────────────────────────── */

function SecuritySection() {
  const r = useReveal();
  const layers = [
    {
      icon: "\u{1F6E1}\u{FE0F}",
      title: "Layer 1 — Proof-of-Work",
      detail: "SHA-256 mining: each coin requires real computational effort. Dynamic difficulty adjustment every epoch. Identical to Bitcoin's mining algorithm.",
      color: "var(--primary)",
    },
    {
      icon: "\u{1F58A}\u{FE0F}",
      title: "Layer 2 — Ed25519 Signature",
      detail: "The network signs every coin with its Ed25519 private key DNA (256-bit security). Any wallet can verify the signature offline using the embedded Network Genome. Mathematically impossible to forge.",
      color: "var(--secondary)",
    },
    {
      icon: "\u{1F9EC}",
      title: "Layer 3 — RFLP Fingerprint",
      detail: "Biological proof of parentage. The network generates a unique parentage marker DNA for each coin, containing restriction enzyme sites derived from the private key. Digest with public enzymes (EcoRI, BamHI, HindIII, PstI, SalI) to see the gel-band pattern — a visual \"paternity test\" proving the coin was born from this network.",
      color: "#d29922",
    },
    {
      icon: "\u{1F6AB}",
      title: "Layer 4 — Nullifier + Duplicate Tracking",
      detail: "Deterministic nullifiers (SHA-256 of serial + private key) prevent double-spending. The network also tracks all signed serial hashes to reject duplicate submissions. Two overlapping mechanisms for absolute safety.",
      color: "#f85149",
    },
  ];
  return (
    <section className="section parallax-section" id="security" ref={useParallax()}>
      <SideHelix side="left" top="10%" />
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Security</span>
          <h2 className="section-title">Defense in <span className="grad-text">depth</span></h2>
          <p className="section-sub">
            Four independent layers of protection. An attacker must break ALL of them
            simultaneously — a mathematical and biological impossibility.
          </p>
        </div>
        <div className="security-layers">
          {layers.map((l, i) => (
            <div key={i} className="security-layer" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="security-icon" style={{ borderColor: l.color }}>
                <span>{l.icon}</span>
              </div>
              <div className="security-body">
                <h3 style={{ color: l.color }}>{l.title}</h3>
                <p>{l.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="security-gel-explainer">
          <div className="gel-ascii">
            <div className="gel-ascii-header">Gel Electrophoresis — Parentage Verification</div>
            <pre>{`  Network    Coin #1    Coin #2    FORGERY
  ┈┈┈┈┈┈┈    ┈┈┈┈┈┈┈    ┈┈┈┈┈┈┈    ┈┈┈┈┈┈┈
  ████         ████       ████
    ██           ██         ██
      ████         ████       ████
        ██           ██
  ██               ██       ██       ██████
    ████                       ████
                                       ██
  ──────    ───────    ───────    ───────
  PARENT    MATCH ✓    MATCH ✓    NO MATCH ✗`}</pre>
          </div>
          <p className="text-sm text-muted">
            Like a real DNA paternity test: restriction enzymes cut the marker DNA at known recognition
            sequences. The resulting fragment lengths form a unique "bar code." A legitimate coin's bands
            align with the network's pattern. A forged coin produces random, non-matching bands.
          </p>
        </div>
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link to="/how" className="btn btn-secondary btn-lg">
            Read the full technical breakdown
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Payment Gateway ──────────────────────────────────────────────────── */

function PaymentGateway() {
  const r = useReveal();
  return (
    <section className="section" id="gateway">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Payment Gateway</span>
          <h2 className="section-title">Accept zBioCoin <span className="grad-text">anywhere</span></h2>
          <p className="section-sub">
            Add zBioCoin payments to any website with a single script tag. Popup checkout,
            cryptographic verification, zero fees. Like PayPal &mdash; but decentralized.
          </p>
        </div>
        <div className="gw-grid">
          <div className="gw-card">
            <div className="gw-step">1</div>
            <h3>Add the SDK</h3>
            <div className="code-block" style={{ margin: 0 }}>
              <pre className="code-body" style={{ fontSize: "0.75rem", padding: "0.75rem" }}>{`<script src="https://zcoin.bio/gateway/zcoin-pay.js"></script>`}</pre>
            </div>
          </div>
          <div className="gw-card">
            <div className="gw-step">2</div>
            <h3>Request payment</h3>
            <div className="code-block" style={{ margin: 0 }}>
              <pre className="code-body" style={{ fontSize: "0.75rem", padding: "0.75rem" }}>{`const pay = new ZcoinPay();
const result = await pay.requestPayment({
  amount: 2,
  to: "your-public-key",
  description: "Premium Widget",
});`}</pre>
            </div>
          </div>
          <div className="gw-card">
            <div className="gw-step">3</div>
            <h3>User approves in popup</h3>
            <p className="text-muted text-sm">
              A secure popup opens on zcoin.bio where the buyer selects coins from their wallet
              and approves the transfer. mRNA is created client-side &mdash; private keys never leave
              the browser.
            </p>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: "2.5rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="https://demo.zcoin.bio" target="_blank" rel="noopener" className="btn btn-primary btn-lg btn-glow">
            Try Demo Marketplace
          </a>
          <a href="https://github.com/pipikaex/biocoin-marketplace-demo-payment-gateway" target="_blank" rel="noopener" className="btn btn-secondary btn-lg">
            View Source
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── Build your own ────────────────────────────────────────────────────── */

function BuildYourOwn() {
  const r = useReveal();
  return (
    <section className="section" id="build">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Open platform</span>
          <h2 className="section-title">Build your own <span className="grad-text">biological token</span></h2>
          <p className="section-sub">
            zcoin.bio is open source. Fork it, customize the DNA, set your own difficulty,
            and launch a new network in minutes. Our TypeScript SDK handles everything.
          </p>
        </div>
        <div className="code-block">
          <div className="code-header">
            <span className="code-dot red" />
            <span className="code-dot yellow" />
            <span className="code-dot green" />
            <span className="code-title">Launch your network</span>
          </div>
          <pre className="code-body">{`import {
  generateNetworkKeyPair, sha256,
  mineCoin, signCoinWithNetwork,
  verifyNetworkSignature
} from "@zcoin/core";

// Generate Ed25519 keypair encoded as DNA
const { publicKeyDNA, privateKeyDNA } = generateNetworkKeyPair();
const networkId = sha256(publicKeyDNA).slice(0, 16);

// Mine a coin (180-base gene, SHA-256 proof-of-work)
const coin = mineCoin("00000");
const signed = signCoinWithNetwork(
  coin, privateKeyDNA, networkId, publicKeyDNA
);

// Anyone can verify offline with just the public genome
console.log(verifyNetworkSignature(signed, publicKeyDNA)); // true`}</pre>
        </div>
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <a href="https://github.com/pipikaex/biocoin" target="_blank" rel="noopener" className="btn btn-secondary btn-lg">
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── Roadmap ───────────────────────────────────────────────────────────── */

function Roadmap() {
  const r = useReveal();
  const items = [
    { q: "Now", title: "Genesis", items: ["Browser mining", "Wallet management", "Peer-to-peer transfers", "Network signing", "Payment gateway SDK", "Demo marketplace"], done: true },
    { q: "Q3 2026", title: "Growth", items: ["Mobile wallet app", "Multi-network support", "WordPress / WooCommerce plugin", "Developer SDK + docs"], done: false },
    { q: "Q4 2026", title: "Ecosystem", items: ["Payment gateway plugin", "Smart protein contracts", "Decentralized app store", "Governance via DNA voting"], done: false },
    { q: "2027", title: "Evolution", items: ["Cross-network transfers", "Hardware wallet support", "Enterprise API", "Organism-based DeFi"], done: false },
  ];
  return (
    <section className="section section-alt" id="roadmap">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Roadmap</span>
          <h2 className="section-title">Where we're <span className="grad-text">going</span></h2>
        </div>
        <div className="roadmap">
          {items.map((item, i) => (
            <div key={i} className={`rm-item ${item.done ? "rm-done" : ""}`}
              style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="rm-marker">
                <div className="rm-dot" />
                {i < items.length - 1 && <div className="rm-line" />}
              </div>
              <div className="rm-body">
                <span className="rm-q">{item.q}</span>
                <h3>{item.title}</h3>
                <ul>
                  {item.items.map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Community ─────────────────────────────────────────────────────────── */

function Community() {
  const r = useReveal();
  return (
    <section className="section" id="community">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Community</span>
          <h2 className="section-title">Join the <span className="grad-text">evolution</span></h2>
          <p className="section-sub">
            zcoin.bio is built by the community, for the community. Every miner, trader,
            and developer helps the network grow stronger.
          </p>
        </div>
        <div className="community-grid">
          <a href="https://github.com/pipikaex/biocoin" className="social-card" target="_blank" rel="noopener">
            <div className="social-icon">Core Engine</div>
            <p>Star the repo, contribute code, report bugs, or fork the project to build your own network.</p>
          </a>
          <a href="https://github.com/pipikaex/biocoin-marketplace-demo-payment-gateway" className="social-card" target="_blank" rel="noopener">
            <div className="social-icon">Payment Gateway</div>
            <p>Demo marketplace, embeddable SDK, and integration examples for accepting zBioCoin payments.</p>
          </a>
          <a href="https://demo.zcoin.bio" className="social-card" target="_blank" rel="noopener">
            <div className="social-icon">Live Demo</div>
            <p>Try the marketplace demo &mdash; list items, buy with zBioCoin, see the payment gateway in action.</p>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ────────────────────────────────────────────────────────────────── */

function FAQ() {
  const r = useReveal();
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: "Why should I use zBioCoin?", a: "zBioCoin is the only cryptocurrency where your wallet is living DNA and every coin is a gene you physically own. No KYC, no sign-up, no app download \u2014 mine coins in your browser, trade them offline via mRNA files, and verify them with real biology (gel electrophoresis). There are zero fees for peer-to-peer transfers, a hard cap of 21 million coins with Bitcoin-style halving, and a payment gateway merchants can add with one script tag. If you want a currency that can\u2019t be censored, seized, or inflated \u2014 and that keeps working even if the server disappears \u2014 zBioCoin is built for you." },
    { q: "Is zcoin.bio a real cryptocurrency?", a: "Yes. It uses SHA-256 proof-of-work (same as Bitcoin), Ed25519 asymmetric signatures (same as Solana and Stellar), and nullifier-based double-spend prevention. The biological encoding is a unique representation layer, but the underlying security is mathematically equivalent to established cryptocurrencies." },
    { q: "How do I start mining?", a: "Create a wallet, go to the Mine page, and click 'Start Mining.' Your browser will begin proof-of-work computation in a background Web Worker. Mining runs continuously until you stop it. When a coin is found, it's automatically submitted to the network for Ed25519 signing. No downloads, no hardware \u2014 just a web browser." },
    { q: "Can coins be double-spent?", a: "No. Four overlapping defenses prevent it: (1) SHA-256 proof-of-work, (2) Ed25519 signature verification, (3) RFLP biological fingerprint validation, and (4) nullifier-based spend tracking with duplicate serial rejection. Offline transfers carry a theoretical risk, mitigated by lineage tracking and nullifier broadcast upon reconnection." },
    { q: "What makes zBioCoin different from Bitcoin?", a: "Bitcoin uses a blockchain. zBioCoin uses DNA-encoded wallets, Ed25519 signatures encoded as DNA, and RFLP biological fingerprints for parentage verification. Every wallet carries the Network Genome, so coins are self-validating with both mathematical and biological proof \u2014 even if the server goes offline forever. You can literally run a gel electrophoresis on your coin to prove it's genuine." },
    { q: "Can I create my own token?", a: "Absolutely. The @zcoin/core TypeScript package is open source. Call generateNetworkKeyPair() to get an Ed25519 keypair encoded as DNA, set your difficulty, and deploy. Coins mined on your network carry your unique Ed25519 signature \u2014 they're distinct from zcoin.bio coins but use the same engine." },
    { q: "Is there a pre-mine or ICO?", a: "No. Zero coins were pre-mined. There is no ICO, no VC funding, no token sale. Every coin in existence was mined through proof-of-work by someone contributing compute to the network. The 10% network fee is the only revenue mechanism, and it's transparent." },
    { q: "How do offline transfers work?", a: "When you send a coin, an mRNA payload file is generated containing the coin gene, Ed25519 signature, mining proof, and ownership proofs. The recipient's wallet verifies the signature using the Network Genome \u2014 no server needed. Send via email, USB, QR code, or any medium. When either party connects, the nullifier is broadcast." },
    { q: "What is the DNA actually encoding?", a: "The DNA uses the real human codon table (64 codons \u2192 20 amino acids). Wallet DNA is read by a ribosome function that translates codons into proteins. Coins are 180-base gene sequences yielding ~60 amino acids (259 bits of entropy). Each signed coin also carries parentage marker DNA \u2014 a separate strand with restriction enzyme sites that form a unique RFLP fingerprint. The network's Ed25519 keys are encoded as 128-base DNA strands. Every key, signature, fingerprint, and coin is pure DNA." },
    { q: "What happens if the zcoin.bio server goes down?", a: "Your coins remain valid. Every wallet embeds the Network Genome (Ed25519 public key), and every coin carries its Ed25519 signature plus an RFLP fingerprint. Verification is a pure math + biology operation \u2014 no server needed. Run the gel electrophoresis, verify the Ed25519 signature, and trade coins peer-to-peer forever." },
    { q: "What is RFLP and gel electrophoresis?", a: "RFLP (Restriction Fragment Length Polymorphism) is a real technique from forensic DNA analysis and paternity testing. Restriction enzymes cut DNA at specific recognition sequences (like EcoRI cuts at GAATTC). The resulting fragment lengths form a unique pattern. In zBioCoin, each signed coin carries a parentage marker DNA with restriction sites derived from the network's private key. Digesting it with the public enzyme panel reveals a gel-band pattern that must match the network's known profile \u2014 proving the coin was 'born' from this network." },
  ];
  return (
    <section className="section section-alt" id="faq">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">FAQ</span>
          <h2 className="section-title">Common <span className="grad-text">questions</span></h2>
        </div>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <div key={i} className={`faq-item ${open === i ? "faq-open" : ""}`}
              onClick={() => setOpen(open === i ? null : i)}>
              <div className="faq-q">
                <span>{f.q}</span>
                <span className="faq-arrow">{open === i ? "\u2212" : "+"}</span>
              </div>
              {open === i && <div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ─────────────────────────────────────────────────────────── */

function CTA() {
  const px = useParallax();
  return (
    <section className="cta-section parallax-section" ref={px}>
      <SideHelix side="right" top="10%" />
      <FloatingBases count={15} />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <h2>Ready to mine your first coin?</h2>
        <p>It takes 30 seconds to create a wallet and start mining. No downloads. No signup. Just biology.</p>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <Link to="/mine" className="btn btn-primary btn-lg btn-glow">Start Mining Now</Link>
          <Link to="/wallet" className="btn btn-secondary btn-lg">Create Wallet</Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">&#x29D6; zcoin.bio</div>
            <p className="text-sm text-muted">DNA-based cryptocurrency.<br />Open source. Fair launch.</p>
          </div>
          <div>
            <h4>Product</h4>
            <Link to="/wallet">Wallet</Link>
            <Link to="/mine">Mine</Link>
            <Link to="/transfer">Transfer</Link>
            <Link to="/network">Network</Link>
          </div>
          <div>
            <h4>Resources</h4>
            <Link to="/how-it-works">How it works</Link>
            <a href="#faq">FAQ</a>
            <Link to="/economics">Economics</Link>
            <a href="#roadmap">Roadmap</a>
          </div>
          <div>
            <h4>Community</h4>
            <a href="https://github.com/pipikaex/biocoin" target="_blank" rel="noopener">GitHub</a>
            <a href="https://github.com/pipikaex/biocoin-marketplace-demo-payment-gateway" target="_blank" rel="noopener">Gateway SDK</a>
            <a href="https://demo.zcoin.bio" target="_blank" rel="noopener">Demo Marketplace</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} zcoin.bio &mdash; All rights reserved.</span>
          <span className="text-muted text-xs">Built with DNA, powered by SHA-256 + Ed25519 + RFLP.</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */

const styles = `
/* ── Entrance animations ───────────────── */
.anim-fade-up { animation: animFadeUp 0.8s ease both; }
.anim-fade-down { animation: animFadeDown 0.7s ease both; }
@keyframes animFadeUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
@keyframes animFadeDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }

/* ── Reveal animation ───────────────────── */
[data-reveal="false"] { opacity: 0; transform: translateY(30px); }
[data-reveal="true"] { opacity: 1; transform: translateY(0); transition: opacity 0.7s ease, transform 0.7s ease; }
[data-reveal="true"] .why-card,
[data-reveal="true"] .step,
[data-reveal="true"] .rm-item,
[data-reveal="true"] .persona-card,
[data-reveal="true"] .qs-card,
[data-reveal="true"] .tok-card,
[data-reveal="true"] .gw-card,
[data-reveal="true"] .social-card,
[data-reveal="true"] .security-layer,
[data-reveal="true"] .faq-item {
  animation: fadeUp 0.5s ease both;
}
@keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

/* ── Gradient text ──────────────────────── */
.grad-text {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}

.landing { overflow-x: hidden; position: relative; }

/* ── Floating DNA bases ────────────────── */
.floating-bases {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
}
.float-base {
  position: absolute; font-family: var(--mono); font-weight: 800; color: var(--primary);
  animation: floatDrift linear infinite;
  will-change: transform;
}
@keyframes floatDrift {
  0% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-30px) rotate(8deg); }
  50% { transform: translateY(-10px) rotate(-5deg); }
  75% { transform: translateY(-40px) rotate(12deg); }
  100% { transform: translateY(0) rotate(0deg); }
}

/* ── Side helix decorations ────────────── */
.side-helix {
  position: absolute; z-index: 0; opacity: 0.18;
  display: flex; flex-direction: column; gap: 5px;
  pointer-events: none;
}
.side-helix-left { left: 2%; }
.side-helix-right { right: 2%; }
.sh-rung {
  display: flex; align-items: center; gap: 3px;
  animation: shPulse 5s ease-in-out infinite alternate;
}
.sh-dot { width: 6px; height: 6px; border-radius: 50%; }
.sh-dot.sh-l { background: #f85149; }
.sh-dot.sh-r { background: #3fb950; }
.sh-bar { width: 40px; height: 1.5px; background: var(--border); }
@keyframes shPulse {
  0% { transform: scaleX(0.3) translateX(-6px); opacity: 0.3; }
  50% { transform: scaleX(1.5) translateX(0); opacity: 1; }
  100% { transform: scaleX(0.3) translateX(6px); opacity: 0.3; }
}

/* ── Parallax section ──────────────────── */
.parallax-section { position: relative; overflow: hidden; }

/* ── Generic section ────────────────────── */
.section { padding: 5rem 0; position: relative; }
.section-alt { background: var(--bg-surface); }
.container { max-width: 1140px; margin: 0 auto; padding: 0 1.5rem; position: relative; z-index: 1; }
.section-header { text-align: center; margin-bottom: 3rem; }
.section-tag {
  display: inline-block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--primary); margin-bottom: 0.75rem;
  background: var(--primary-glow); padding: 0.3rem 0.9rem; border-radius: 999px;
}
.section-title { font-size: 2.5rem; font-weight: 800; line-height: 1.2; margin-bottom: 1rem; }
.section-sub { color: var(--text-muted); max-width: 600px; margin: 0 auto; line-height: 1.7; }

/* ── Hero Slider ────────────────────────── */
.hero {
  position: relative; min-height: 92vh;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; padding: 2rem 1.5rem;
}
.hero-bg { position: absolute; inset: 0; z-index: 0; }
.hero-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(0,229,153,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,229,153,0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  animation: gridShift 30s linear infinite;
}
@keyframes gridShift { from { background-position: 0 0; } to { background-position: 60px 60px; } }
.hero-glow {
  position: absolute; top: -200px; left: 50%; transform: translateX(-50%);
  width: 800px; height: 600px;
  background: radial-gradient(ellipse, rgba(0,229,153,0.12) 0%, transparent 70%);
  filter: blur(40px);
}
.hero-glow-parallax { animation: glowBreathe 6s ease-in-out infinite alternate; }
@keyframes glowBreathe {
  0% { opacity: 0.7; transform: translateX(-50%) scale(0.95); }
  100% { opacity: 1; transform: translateX(-50%) scale(1.08); }
}

.hero-slide-content {
  position: relative; z-index: 1; text-align: center; max-width: 820px;
  display: flex; flex-direction: column; align-items: center; gap: 1rem;
}
.hero-badge {
  display: inline-block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--primary); border: 1px solid rgba(0,229,153,0.25);
  padding: 0.35rem 1rem; border-radius: 999px;
}
.hero-title { font-size: 2.8rem; font-weight: 800; line-height: 1.18; }
.hero-sub { font-size: 1.05rem; color: var(--text-muted); line-height: 1.7; max-width: 640px; }
.hero-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
.hero-visual { display: flex; justify-content: center; width: 100%; }
.hero-stats { display: flex; gap: 1.5rem; flex-wrap: wrap; justify-content: center; }
.hero-stat { text-align: center; }
.hero-stat-val { font-family: var(--mono); font-size: 1.8rem; font-weight: 800; color: var(--primary); }
.hero-stat-lbl { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }
.hero-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
.hero-pill {
  display: inline-block; padding: 0.3rem 0.8rem; border-radius: 999px;
  font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; border: 1.5px solid;
}

/* Slider arrows */
.hero-arrow {
  position: absolute; top: 50%; z-index: 2; transform: translateY(-50%);
  width: 48px; height: 48px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.15);
  background: rgba(0,0,0,0.35); backdrop-filter: blur(8px);
  color: var(--text); font-size: 1.4rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.25s;
}
.hero-arrow:hover { background: rgba(0,229,153,0.2); border-color: var(--primary); color: var(--primary); }
.hero-arrow-prev { left: 1rem; }
.hero-arrow-next { right: 1rem; }

/* Dots */
.hero-dots {
  position: absolute; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
  z-index: 2; display: flex; gap: 6px;
}
.hero-dot {
  width: 8px; height: 8px; border-radius: 50%; border: none; padding: 0;
  background: rgba(255,255,255,0.2); cursor: pointer; transition: all 0.3s;
}
.hero-dot:hover { background: rgba(255,255,255,0.5); }
.hero-dot.active { background: var(--primary); width: 24px; border-radius: 4px; }
.hero-counter {
  position: absolute; bottom: 1.5rem; right: 1.5rem; z-index: 2;
  font-family: var(--mono); font-size: 0.72rem; color: var(--text-dim);
}

/* ── Slide mini-component styles ────────── */
.helix-wrap {
  display: flex; flex-direction: column; gap: 4px; opacity: 0.7;
}
.helix-rung {
  display: flex; align-items: center; gap: 3px;
  animation: helixPulse 4s ease-in-out infinite alternate;
}
.h-dot { width: 8px; height: 8px; border-radius: 50%; }
.h-dot.l { background: #f85149; }
.h-dot.r { background: #3fb950; }
.h-bar { width: 60px; height: 1.5px; background: var(--border); }
@keyframes helixPulse {
  0% { transform: scaleX(0.4); opacity: 0.4; }
  50% { transform: scaleX(1.4); opacity: 1; }
  100% { transform: scaleX(0.4); opacity: 0.4; }
}

.slide-codons { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
.slide-codon { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.slide-codon-bases { font-family: var(--mono); font-size: 1.1rem; font-weight: 700; letter-spacing: 3px; }
.slide-codon-arrow { color: var(--text-muted); font-size: 1rem; }
.slide-codon-amino {
  width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center;
  justify-content: center; font-family: var(--mono); font-size: 0.72rem; font-weight: 700; color: white;
}

.slide-blocks { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.slide-block {
  width: 52px; height: 52px; border: 2px solid var(--text-muted); border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-size: 0.7rem; color: var(--text-muted);
}
.slide-block.heavy { border-color: #f85149; color: #f85149; }

.slide-telo { width: 100%; max-width: 600px; }
.slide-telo-bar {
  display: flex; align-items: center; height: 52px; border-radius: 26px;
  border: 2px solid rgba(255,255,255,0.12); overflow: hidden; background: rgba(255,255,255,0.02);
}
.slide-telo-end {
  height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 10px;
  font-family: var(--mono); font-size: 0.65rem; font-weight: 700; color: var(--bg);
  background: linear-gradient(90deg, var(--primary), rgba(0,229,153,0.4));
  min-width: 18%;
}
.slide-telo-end.left { border-radius: 26px 0 0 26px; }
.slide-telo-end.right { border-radius: 0 26px 26px 0; background: linear-gradient(270deg, var(--primary), rgba(0,229,153,0.4)); }
.slide-telo-body { flex: 1; text-align: center; font-family: var(--mono); font-size: 0.9rem; font-weight: 700; }

.slide-gel { display: flex; gap: 1.5rem; justify-content: center; }
.slide-gel-lane { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.slide-gel-label { font-size: 0.72rem; font-weight: 700; }
.slide-gel-track {
  width: 40px; height: 180px; background: linear-gradient(180deg, rgba(139,92,246,0.08), rgba(139,92,246,0.02));
  border: 1px solid rgba(139,92,246,0.25); border-radius: 4px; position: relative; overflow: hidden;
}
.slide-gel-band {
  position: absolute; left: 3px; right: 3px; height: 4px; border-radius: 2px;
  animation: gelSlide 0.6s ease both;
}
@keyframes gelSlide { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
.slide-gel-result { font-size: 0.68rem; font-weight: 700; color: var(--primary); }
.slide-gel-result.fail { color: #f85149; }

.slide-shields { display: flex; flex-direction: column; gap: 0.6rem; width: 100%; max-width: 480px; }
.slide-shield {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 1rem;
  border-radius: 10px; border: 1.5px solid; background: rgba(0,0,0,0.2);
  font-size: 0.85rem;
}
.slide-shield-num {
  width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-weight: 900; font-size: 0.8rem; color: white; flex-shrink: 0;
}

.slide-mrna { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; justify-content: center; }
.slide-mrna-icon { font-size: 2.5rem; }
.slide-mrna-arrow { font-size: 1.8rem; color: var(--text-muted); }
.slide-mrna-envelope {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 0.75rem 1.5rem; border: 2px solid var(--primary); border-radius: 10px;
  background: rgba(0,229,153,0.04);
}
.slide-mrna-envelope span:first-child { font-size: 1.5rem; }
.slide-mrna-envelope small { font-weight: 700; font-size: 0.75rem; }
.slide-mrna-stamp { font-size: 0.6rem; color: var(--primary); font-weight: 700; }

.slide-code {
  width: 100%; max-width: 520px; background: #0d1117; border: 1px solid var(--border);
  border-radius: 10px; padding: 1rem 1.25rem; text-align: left;
}
.slide-code pre {
  font-family: var(--mono); font-size: 0.72rem; line-height: 1.7;
  color: #c9d1d9; margin: 0; white-space: pre-wrap;
}

.slide-personas { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; width: 100%; max-width: 600px; }
.slide-persona {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 0.75rem 0.5rem; border: 1px solid var(--border); border-radius: 10px;
  background: rgba(255,255,255,0.02); text-align: center; font-size: 0.72rem; color: var(--text-muted);
}
.slide-persona-emoji { font-size: 1.8rem; }
.slide-persona strong { color: var(--primary); font-size: 0.78rem; }

.slide-economy { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; width: 100%; max-width: 500px; }
.slide-eco-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 0.75rem 0.5rem; border: 1px solid var(--border); border-radius: 10px;
  font-size: 0.78rem; font-weight: 600;
}
.slide-eco-item span:first-child { font-size: 1.5rem; }

.slide-early { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; justify-content: center; }
.slide-era { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.slide-era-icon { font-size: 2.5rem; }
.slide-era strong { font-family: var(--mono); font-size: 1.1rem; font-weight: 900; }
.slide-era span { font-size: 0.72rem; color: var(--text-muted); }
.slide-era-arrow { font-size: 2rem; color: var(--text-dim); }

@media (max-width: 640px) {
  .hero-title { font-size: 1.8rem; }
  .hero { min-height: auto; padding: 4rem 1rem 3rem; }
  .hero-arrow { width: 36px; height: 36px; font-size: 1rem; }
  .hero-arrow-prev { left: 0.5rem; }
  .hero-arrow-next { right: 0.5rem; }
  .hero-stat-val { font-size: 1.3rem; }
  .slide-personas { grid-template-columns: repeat(2, 1fr); }
  .slide-economy { grid-template-columns: repeat(2, 1fr); }
  .helix-wrap { display: none; }
}

.btn-glow { box-shadow: 0 0 30px rgba(0,229,153,0.25); }
.btn-glow:hover { box-shadow: 0 0 50px rgba(0,229,153,0.4); }
.btn-ghost {
  background: transparent; color: var(--text-muted); border: 1px solid transparent;
  padding: 0.65rem 1.4rem; border-radius: var(--radius); font-weight: 500;
  cursor: pointer; font-size: 0.9rem; text-decoration: none;
}
.btn-ghost:hover { color: var(--text); text-decoration: none; }

/* ── Ticker ─────────────────────────────── */
.ticker {
  background: var(--bg-card); border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border); padding: 0.65rem 0;
  overflow: hidden; position: relative; z-index: 1;
}
.ticker-inner {
  display: flex; align-items: center; justify-content: center;
  gap: 1rem; font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap;
  max-width: 1140px; margin: 0 auto; padding: 0 1rem;
}
.ticker-inner b { color: var(--text); }
.ticker-inner .sep { color: var(--border); }
.ticker-live { color: var(--success); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
.pulse-dot {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: var(--success); animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ── Quick Start ───────────────────────── */
.qs-steps {
  display: flex; align-items: stretch; justify-content: center; gap: 1rem; flex-wrap: wrap;
}
.qs-card {
  flex: 1; min-width: 220px; max-width: 280px;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 2rem 1.5rem; text-align: center;
  display: flex; flex-direction: column; align-items: center;
  transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
}
.qs-card:hover { border-color: var(--primary); box-shadow: 0 0 30px var(--primary-glow); transform: translateY(-4px); }
.qs-num {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-family: var(--mono); font-size: 0.85rem;
  background: var(--primary-glow); border: 2px solid var(--primary); color: var(--primary);
  margin-bottom: 0.75rem;
}
.qs-icon { font-size: 2rem; margin-bottom: 0.75rem; }
.qs-card h3 { font-size: 1rem; margin-bottom: 0.5rem; }
.qs-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 1rem; }
.qs-arrow { color: var(--text-dim); font-size: 1.5rem; display: flex; align-items: center; }
@media (max-width: 768px) {
  .qs-steps { flex-direction: column; align-items: center; }
  .qs-arrow { transform: rotate(90deg); }
  .qs-card { max-width: 100%; }
}

/* ── Why cards ──────────────────────────── */
.why-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
.why-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1.75rem;
  transition: all 0.3s cubic-bezier(.4,0,.2,1);
}
.why-card:hover { border-color: var(--primary); transform: translateY(-6px) scale(1.02); box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 0 20px rgba(0,229,153,0.1); }
.why-icon { font-size: 1.75rem; margin-bottom: 0.75rem; }
.why-card h3 { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.5rem; }
.why-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.7; }

/* ── Steps (How it works) ──────────────── */
.steps { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 0; padding: 0 1rem; }
.step { display: flex; gap: 1.25rem; align-items: flex-start; overflow: hidden; padding: 1.5rem 0; }
.step-indicator { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 20px; padding-top: 0.2rem; }
.step-dot {
  width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--primary);
  background: var(--bg); flex-shrink: 0;
  animation: dotGlow 3s ease-in-out infinite alternate;
}
@keyframes dotGlow {
  0% { box-shadow: 0 0 4px transparent; }
  100% { box-shadow: 0 0 14px rgba(0,229,153,0.4); }
}
.step-line { width: 2px; flex: 1; min-height: 30px; background: linear-gradient(180deg, var(--primary) 0%, var(--border) 100%); margin-top: 4px; }
.step-n { font-family: var(--mono); font-size: 2rem; font-weight: 800; flex-shrink: 0; width: 50px; text-align: right; }
.step-body { flex: 1; min-width: 0; overflow: hidden; }
.step-body h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.4rem; }
.step-body p { font-size: 0.88rem; color: var(--text-muted); line-height: 1.7; }

/* ── Persona ────────────────────────────── */
.persona-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
.persona-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 2rem;
  transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
}
.persona-card:hover { border-color: var(--border-bright); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
.persona-card h3 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; }
.persona-card p { font-size: 0.88rem; color: var(--text-muted); line-height: 1.7; margin-bottom: 1rem; }

/* ── Tokenomics ─────────────────────────── */
.tok-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
.tok-card {
  text-align: center; padding: 1.75rem;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
  transition: transform 0.3s, border-color 0.3s;
}
.tok-card:hover { transform: translateY(-3px); border-color: var(--primary); }
.tok-val { font-family: var(--mono); font-size: 2rem; font-weight: 800; color: var(--primary); }
.tok-lbl { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem; }
.tok-explain {
  max-width: 680px; margin: 0 auto; text-align: center;
  font-size: 0.9rem; color: var(--text-muted); line-height: 1.8;
}

/* ── Security ──────────────────────────── */
.security-layers { max-width: 720px; margin: 0 auto 2rem; }
.security-layer {
  display: flex; gap: 1.25rem; align-items: flex-start;
  padding: 1.25rem 0; border-bottom: 1px solid var(--border);
}
.security-layer:last-child { border-bottom: none; }
.security-icon {
  width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; border: 2px solid; background: var(--bg-card);
  transition: transform 0.3s;
}
.security-layer:hover .security-icon { transform: scale(1.15) rotate(-5deg); }
.security-body h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.3rem; }
.security-body p { font-size: 0.88rem; color: var(--text-muted); line-height: 1.7; }
.security-gel-explainer {
  max-width: 720px; margin: 0 auto;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1.5rem; text-align: center;
}
.gel-ascii { margin-bottom: 1rem; }
.gel-ascii-header {
  font-size: 0.8rem; font-weight: 700; color: var(--primary);
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.75rem;
}
.gel-ascii pre {
  font-family: var(--mono); font-size: 0.72rem; line-height: 1.5;
  color: #3fb950; margin: 0; text-align: left; display: inline-block;
}

/* ── Gel Electrophoresis Section ────────── */
.gel-section {
  background: linear-gradient(180deg, var(--bg) 0%, var(--bg-surface) 50%, var(--bg) 100%);
}
.gel-anim-wrap {
  max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 1.25rem;
}
.gel-canvas {
  width: 100%; height: 460px; border-radius: var(--radius-lg);
  background: linear-gradient(180deg, rgba(6,9,15,0.95) 0%, rgba(10,14,22,0.98) 100%);
  border: 1px solid var(--border);
}
.gel-progress-track {
  width: 100%; height: 3px; border-radius: 2px; background: var(--border); overflow: hidden;
}
.gel-progress-fill {
  height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary));
  border-radius: 2px; transition: width 0.1s linear;
}
.gel-step-bar {
  display: flex; flex-direction: column; gap: 0.4rem; width: 100%;
}
.gel-step {
  display: flex; align-items: center; gap: 0.6rem;
  font-size: 0.78rem; color: var(--text-dim); transition: all 0.5s ease;
}
.gel-step.active { color: var(--text-muted); }
.gel-step.current { color: var(--primary); font-weight: 600; }
.gel-step-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border); background: var(--bg);
  transition: all 0.5s ease;
}
.gel-step.active .gel-step-dot {
  background: var(--primary); border-color: var(--primary);
  box-shadow: 0 0 6px rgba(0,229,153,0.35);
}
.gel-step.current .gel-step-dot {
  box-shadow: 0 0 12px rgba(0,229,153,0.6);
}
.gel-enzyme-legend {
  display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: center;
}
.gel-enzyme-pill {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.2rem 0.55rem; border-radius: 999px; border: 1.5px solid;
  font-size: 0.68rem; font-weight: 700;
}
.gel-enzyme-site {
  font-family: var(--mono); font-weight: 400; font-size: 0.6rem; opacity: 0.65;
}
@media (max-width: 640px) {
  .gel-canvas { height: 340px; }
  .gel-step span { font-size: 0.68rem; }
  .gel-enzyme-pill { font-size: 0.58rem; padding: 0.15rem 0.4rem; }
}

/* ── Flow Animation ───────────────────── */
.flow-section { background: var(--bg); }
.flow-layout {
  display: flex; gap: 2rem; align-items: flex-start; margin-top: 2rem;
}
.flow-steps-col {
  flex: 0 0 340px; display: flex; flex-direction: column; gap: 0.5rem;
}
.flow-canvas-col {
  flex: 1; position: sticky; top: 5rem; display: flex; flex-direction: column; align-items: center;
}
.flow-canvas {
  width: 100%; height: 400px; border-radius: 12px;
  border: 1px solid var(--border); background: rgba(6,9,15,0.6);
}
.flow-progress {
  display: flex; gap: 6px; margin-top: 0.75rem; justify-content: center;
}
.flow-dot {
  width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.08); transition: all 0.4s;
}
.flow-dot.active { background: var(--fc); border-color: var(--fc); box-shadow: 0 0 8px var(--fc); transform: scale(1.3); }
.flow-dot.done { background: var(--fc); border-color: var(--fc); opacity: 0.4; }

.flow-step-btn {
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid var(--border);
  background: transparent; cursor: pointer; text-align: left;
  transition: all 0.35s; color: rgba(255,255,255,0.35); width: 100%;
}
.flow-step-btn:hover { border-color: var(--fc); background: rgba(255,255,255,0.02); }
.flow-step-btn.active {
  border-color: var(--fc); background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.9); box-shadow: 0 0 18px rgba(0,0,0,0.3);
}
.flow-step-btn.done { border-color: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }
.flow-step-icon { font-size: 1.5rem; line-height: 1; flex-shrink: 0; margin-top: 0.1rem; }
.flow-step-info { flex: 1; min-width: 0; }
.flow-step-num { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.flow-step-title { font-size: 0.9rem; font-weight: 600; color: inherit; margin-top: 0.1rem; }
.flow-step-desc {
  font-size: 0.72rem; line-height: 1.5; color: rgba(255,255,255,0.3);
  margin-top: 0.2rem; max-height: 0; overflow: hidden; transition: max-height 0.4s ease, opacity 0.3s;
  opacity: 0;
}
.flow-step-btn.active .flow-step-desc { max-height: 200px; opacity: 1; }

@media (max-width: 768px) {
  .flow-layout { flex-direction: column; }
  .flow-steps-col { flex: unset; width: 100%; flex-direction: row; overflow-x: auto; gap: 0.5rem; padding-bottom: 0.5rem; }
  .flow-step-btn { min-width: 140px; flex-shrink: 0; }
  .flow-step-desc { font-size: 0.65rem; }
  .flow-canvas-col { position: static; }
  .flow-canvas { height: 320px; }
}

/* ── Gateway ───────────────────────────── */
.gw-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
.gw-grid .gw-card:last-child { grid-column: 1 / -1; }
.gw-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1.75rem;
  transition: transform 0.3s, border-color 0.3s;
}
.gw-card:hover { transform: translateY(-3px); border-color: var(--primary); }
.gw-card h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }
.gw-step {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--primary-glow); color: var(--primary);
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.88rem; margin-bottom: 0.75rem;
}
@media (max-width: 900px) { .gw-grid { grid-template-columns: 1fr; } }

/* ── Code block ─────────────────────────── */
.code-block {
  max-width: 700px; margin: 0 auto;
  background: #0d1117; border: 1px solid var(--border); border-radius: var(--radius-lg);
  overflow: hidden;
}
.code-header {
  display: flex; align-items: center; gap: 6px; padding: 0.75rem 1rem;
  background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border);
}
.code-dot { width: 10px; height: 10px; border-radius: 50%; }
.code-dot.red { background: #f85149; }
.code-dot.yellow { background: #d29922; }
.code-dot.green { background: #3fb950; }
.code-title { margin-left: 0.5rem; font-size: 0.75rem; color: var(--text-muted); }
.code-body {
  padding: 1.25rem; font-family: var(--mono); font-size: 0.8rem;
  line-height: 1.8; color: #c9d1d9; overflow-x: auto; margin: 0;
}

/* ── Roadmap ────────────────────────────── */
.roadmap { max-width: 600px; margin: 0 auto; }
.rm-item { display: flex; gap: 1.25rem; }
.rm-marker { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 20px; }
.rm-dot {
  width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--border); background: var(--bg); flex-shrink: 0;
  transition: transform 0.3s;
}
.rm-item:hover .rm-dot { transform: scale(1.4); }
.rm-done .rm-dot { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 10px rgba(0,229,153,0.3); }
.rm-line { width: 2px; flex: 1; background: var(--border); min-height: 40px; }
.rm-body { padding-bottom: 2rem; }
.rm-q { font-size: 0.72rem; font-weight: 600; color: var(--primary); letter-spacing: 0.08em; text-transform: uppercase; }
.rm-body h3 { font-size: 1.1rem; font-weight: 700; margin: 0.25rem 0 0.5rem; }
.rm-body ul { list-style: none; padding: 0; }
.rm-body li { font-size: 0.85rem; color: var(--text-muted); line-height: 1.8; padding-left: 1rem; position: relative; }
.rm-body li::before { content: "\\2022"; position: absolute; left: 0; color: var(--border-bright); }

/* ── Community ──────────────────────────── */
.community-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
.social-card {
  display: block; text-decoration: none; color: var(--text);
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 2rem; text-align: center;
  transition: all 0.3s cubic-bezier(.4,0,.2,1);
}
.social-card:hover { border-color: var(--primary); transform: translateY(-5px); text-decoration: none; box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
.social-icon { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--primary); }
.social-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; }

/* ── FAQ ────────────────────────────────── */
.faq-list { max-width: 720px; margin: 0 auto; }
.faq-item {
  border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.5rem;
  cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s;
}
.faq-item:hover { border-color: var(--border-bright); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
.faq-open { border-color: var(--primary); }
.faq-q {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 1.25rem; font-weight: 600; font-size: 0.95rem;
}
.faq-arrow {
  font-size: 1.2rem; color: var(--text-muted); flex-shrink: 0; margin-left: 1rem;
  transition: transform 0.25s;
}
.faq-open .faq-arrow { transform: rotate(45deg); }
.faq-a {
  padding: 0 1.25rem 1rem; font-size: 0.88rem; color: var(--text-muted); line-height: 1.8;
  animation: fadeSlideDown 0.3s ease;
}
@keyframes fadeSlideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── CTA ────────────────────────────────── */
.cta-section {
  padding: 5rem 1.5rem; text-align: center; position: relative; overflow: hidden;
  background: radial-gradient(ellipse at 50% 100%, rgba(0,229,153,0.08) 0%, transparent 60%);
  border-top: 1px solid var(--border);
}
.cta-section h2 { font-size: 2.2rem; font-weight: 800; margin-bottom: 0.75rem; }
.cta-section p { color: var(--text-muted); margin-bottom: 2rem; max-width: 480px; margin-left: auto; margin-right: auto; }

/* ── Footer ─────────────────────────────── */
.site-footer {
  border-top: 1px solid var(--border); padding: 3rem 0 2rem;
  background: var(--bg-surface); position: relative; z-index: 1;
}
.footer-grid {
  display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 2rem;
  margin-bottom: 2.5rem;
}
.footer-brand { font-size: 1.2rem; font-weight: 800; margin-bottom: 0.5rem; }
.footer-grid h4 { font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.75rem; }
.footer-grid a { display: block; font-size: 0.88rem; color: var(--text-muted); padding: 0.25rem 0; text-decoration: none; transition: color 0.2s; }
.footer-grid a:hover { color: var(--primary); }
.footer-bottom {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 1.5rem; border-top: 1px solid var(--border);
  font-size: 0.8rem; color: var(--text-muted);
}

/* ── Responsive ─────────────────────────── */
@media (max-width: 900px) {
  .why-grid { grid-template-columns: repeat(2, 1fr); }
  .tok-grid { grid-template-columns: repeat(2, 1fr); }
  .community-grid { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .side-helix { display: none; }
}
@media (max-width: 640px) {
  .section { padding: 3rem 0; }
  .section-title { font-size: 1.8rem; }
  .why-grid, .persona-grid { grid-template-columns: 1fr; }
  .tok-grid { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: 1fr; }
  .footer-bottom { flex-direction: column; gap: 0.5rem; text-align: center; }
  .side-helix { display: none; }
  .floating-bases { display: none; }
}
`;
