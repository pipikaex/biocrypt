import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type NetworkStats } from "../api";
import { useReveal } from "../hooks/useReveal";

export function Landing() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  useEffect(() => { api.getNetworkStats().then(setStats).catch(() => {}); }, []);

  return (
    <div className="landing">
      <Hero />
      <Ticker stats={stats} />
      <WhySection />
      <HowItWorks />
      <ForEveryone />
      <Tokenomics stats={stats} />
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

/* ─── Hero ──────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="hero">
      <div className="hero-bg">
        <div className="hero-grid" />
        <div className="hero-glow" />
        <HelixAnimation />
      </div>
      <div className="hero-content">
        <div className="hero-badge">Open Source &middot; Fair Launch &middot; No ICO</div>
        <h1 className="hero-title">
          The first cryptocurrency<br />
          powered by <span className="grad-text">biology</span>
        </h1>
        <p className="hero-sub">
          Coins are genes. Wallets are DNA strands. Mining is protein synthesis.
          No blockchain needed &mdash; just the same math that secures Bitcoin,
          wrapped in the language of life.
        </p>
        <div className="hero-actions">
          <Link to="/mine" className="btn btn-primary btn-lg btn-glow">
            Start Mining &mdash; Free
          </Link>
          <Link to="/wallet" className="btn btn-secondary btn-lg">
            Create Wallet
          </Link>
          <a href="#how" className="btn btn-ghost btn-lg">Learn More &darr;</a>
        </div>
        <div className="hero-proof">
          <span>SHA-256 Proof-of-Work</span>
          <span className="sep">&middot;</span>
          <span>Browser-based mining</span>
          <span className="sep">&middot;</span>
          <span>Offline transfers</span>
        </div>
      </div>
    </section>
  );
}

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

/* ─── Live ticker ───────────────────────────────────────────────────────── */

function Ticker({ stats }: { stats: NetworkStats | null }) {
  if (!stats) return null;
  return (
    <div className="ticker">
      <div className="ticker-inner">
        <span>Network: <b>{stats.networkId}</b></span>
        <span className="sep">&middot;</span>
        <span>Difficulty: <b className="mono">{stats.difficulty}</b></span>
        <span className="sep">&middot;</span>
        <span>Coins mined: <b>{stats.totalCoins}</b></span>
        <span className="sep">&middot;</span>
        <span>Wallets: <b>{stats.totalWallets}</b></span>
        <span className="sep">&middot;</span>
        <span className="pulse-dot" /> Live
      </div>
    </div>
  );
}

/* ─── Why zcoin? ────────────────────────────────────────────────────────── */

function WhySection() {
  const r = useReveal();
  const cards = [
    { icon: "&#x1F9EC;", title: "Mine in your browser", desc: "No GPU rigs, no electricity bills. Open a tab and your browser's CPU does the work. Anyone with a web browser can earn coins." },
    { icon: "&#x26D3;&#xFE0F;", title: "No blockchain", desc: "Faster, lighter, more private. We use nullifier-based gossip for double-spend prevention \u2014 the same approach as Zcash, without the chain." },
    { icon: "&#x1F510;", title: "Bitcoin-grade crypto", desc: "SHA-256 proof-of-work, deterministic ownership proofs, and cryptographic nullifiers. The math is identical to Bitcoin." },
    { icon: "&#x1F4E1;", title: "Offline transfers", desc: "Send coins without internet. Export an mRNA file, hand it to someone on a USB stick, they import it. True peer-to-peer." },
    { icon: "&#x1F52C;", title: "DNA-encoded value", desc: "Every coin is a gene sequence. Every wallet is a DNA strand. Proteins form public keys. Biology meets cryptography." },
    { icon: "&#x1F680;", title: "Build your own", desc: "Fork the network, create your own coin with custom DNA. Our TypeScript SDK makes it trivial to launch a new biological token." },
  ];
  return (
    <section className="section" id="why">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Why zcoin?</span>
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

/* ─── How it works ──────────────────────────────────────────────────────── */

function HowItWorks() {
  const r = useReveal();
  const steps = [
    { n: "01", title: "Create a wallet", desc: "Your browser generates a random DNA strand \u2014 6,000 bases of T, A, C, G. A private key DNA strand is derived alongside it. No server, no account, no email.", color: "var(--primary)" },
    { n: "02", title: "Mine coins", desc: "Click \u201CStart Mining.\u201D A Web Worker on your device brute-forces a nonce until SHA-256(coin gene + nonce) starts with enough zeros. This is real proof-of-work \u2014 same algorithm as Bitcoin.", color: "var(--secondary)" },
    { n: "03", title: "Get signed", desc: "Your mined coin is submitted to the zcoin.bio network. The server validates your proof and signs the coin with the network\u2019s DNA, making it spendable anywhere on the network.", color: "#d29922" },
    { n: "04", title: "Trade & transfer", desc: "Send coins by generating an mRNA \u201Cvirus\u201D that removes the gene from your wallet. The recipient applies it to theirs. Works online or offline via .mrna files.", color: "#f85149" },
  ];
  return (
    <section className="section section-alt" id="how">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">How it works</span>
          <h2 className="section-title">From DNA to <span className="grad-text">digital gold</span></h2>
        </div>
        <div className="steps">
          {steps.map((s, i) => (
            <div key={i} className="step" style={{ animationDelay: `${i * 0.12}s` }}>
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
            <p>Accept zcoin as payment. Integrate our TypeScript SDK. Coins are verified cryptographically \u2014 no third-party settlement.</p>
            <Link to="/network" className="btn btn-secondary btn-sm">Learn More</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Tokenomics ────────────────────────────────────────────────────────── */

function Tokenomics({ stats }: { stats: NetworkStats | null }) {
  const r = useReveal();
  const liveDifficulty = stats?.difficulty ?? "00000";
  return (
    <section className="section section-alt" id="tokenomics">
      <div className="container" ref={r.ref} data-reveal={r.visible}>
        <div className="section-header">
          <span className="section-tag">Tokenomics</span>
          <h2 className="section-title">Fair launch. <span className="grad-text">No pre-mine. No VC.</span></h2>
          <p className="section-sub">Every single coin must be mined through proof-of-work. The only way to create value is to contribute compute.</p>
        </div>
        <div className="tok-grid">
          <div className="tok-card">
            <div className="tok-val">SHA-256</div>
            <div className="tok-lbl">Proof-of-Work Algorithm</div>
          </div>
          <div className="tok-card">
            <div className="tok-val mono">{liveDifficulty}</div>
            <div className="tok-lbl">Current Difficulty ({liveDifficulty.length} leading zeros)</div>
          </div>
          <div className="tok-card">
            <div className="tok-val">10%</div>
            <div className="tok-lbl">Network Fee Rate</div>
          </div>
          <div className="tok-card">
            <div className="tok-val">&infin;</div>
            <div className="tok-lbl">No Max Supply</div>
          </div>
          <div className="tok-card">
            <div className="tok-val">0</div>
            <div className="tok-lbl">Pre-mined Coins</div>
          </div>
          <div className="tok-card">
            <div className="tok-val">1 gene</div>
            <div className="tok-lbl">Atomic Unit</div>
          </div>
        </div>
        <div className="tok-explain">
          <p>
            <b>How value is created:</b> Each coin requires real computational work to mine.
            Difficulty scales with network participation. Coins are signed by the network's
            unique DNA, making them non-forgeable. The 10% network fee means that for every
            ~10 coins mined, the network earns one \u2014 funding development and infrastructure.
          </p>
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
          <pre className="code-body">{`import { generateDNA, sha256, mineCoin, signCoinWithNetwork } from "@zcoin/core";

// Generate your network's unique DNA identity
const networkDNA = generateDNA(6000);
const networkId = "mytoken-" + sha256(networkDNA).slice(0, 12);

// Mine a coin on your network
const coin = mineCoin("000");
const signed = signCoinWithNetwork(coin, networkDNA, networkId);

console.log(signed.networkId);       // "mytoken-a1b2c3d4e5f6"
console.log(signed.networkSignature); // unique to YOUR network`}</pre>
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
    { q: "Now", title: "Genesis", items: ["Browser mining", "Wallet management", "Peer-to-peer transfers", "Network signing"], done: true },
    { q: "Q3 2026", title: "Growth", items: ["Mobile wallet app", "Multi-network support", "Marketplace for coin trading", "Developer SDK + docs"], done: false },
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
            <div className="social-icon">GitHub</div>
            <p>Star the repo, contribute code, report bugs, or fork the project to build your own network.</p>
          </a>
          <a href="https://github.com/pipikaex/biocoin/discussions" className="social-card" target="_blank" rel="noopener">
            <div className="social-icon">Discussions</div>
            <p>Chat with miners and developers. Get help, share ideas, and build together.</p>
          </a>
          <a href="https://github.com/pipikaex/biocoin/issues" className="social-card" target="_blank" rel="noopener">
            <div className="social-icon">Issues &amp; Roadmap</div>
            <p>Follow development progress, request features, and track network announcements.</p>
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
    { q: "Is zcoin.bio a real cryptocurrency?", a: "Yes. It uses SHA-256 proof-of-work (the same algorithm as Bitcoin), cryptographic ownership proofs, and nullifier-based double-spend prevention. The biological encoding is a unique representation layer, but the underlying security is mathematically equivalent to established cryptocurrencies." },
    { q: "How do I start mining?", a: "Create a wallet, go to the Mine page, and click 'Start Mining.' Your browser will begin proof-of-work computation in a background Web Worker. When a coin is found, it's automatically submitted to the network for signing. No downloads, no hardware \u2014 just a web browser." },
    { q: "Can coins be double-spent?", a: "Online: no. When a coin is spent, a cryptographic nullifier is broadcast to the gossip network. Any attempt to spend the same coin again is rejected. Offline transfers carry a theoretical risk (like handing someone a check), which is mitigated by lineage tracking and conflict resolution when reconnecting." },
    { q: "What makes zcoin different from Bitcoin?", a: "Bitcoin uses a blockchain (distributed ledger). zcoin uses DNA-encoded wallets and nullifier gossip \u2014 no chain, no blocks. This means faster transactions, lighter infrastructure, and the ability to operate fully offline. The trade-off is that we rely on gossip consensus rather than Nakamoto consensus." },
    { q: "Can I create my own token?", a: "Absolutely. The @zcoin/core TypeScript package is open source. Generate your own network DNA, set your difficulty, and deploy. Coins mined on your network will have your unique network signature \u2014 they're distinct from zcoin.bio coins but use the same engine." },
    { q: "Is there a pre-mine or ICO?", a: "No. Zero coins were pre-mined. There is no ICO, no VC funding, no token sale. Every coin in existence was mined through proof-of-work by someone contributing compute to the network. The 10% network fee is the only revenue mechanism, and it's transparent." },
    { q: "How do offline transfers work?", a: "When you send a coin, an mRNA payload file is generated. This file contains the coin gene, ownership proofs, and transfer metadata. You can send it via email, USB, QR code, or any medium. The recipient imports it into their wallet. When either party connects to the network, the nullifier is broadcast to prevent double-spending." },
    { q: "What is the DNA actually encoding?", a: "The DNA uses the real human codon table (64 codons \u2192 20 amino acids). Wallet DNA is read by a ribosome function that translates codons into proteins. The protein chain hash becomes your public key. Coins are gene sequences with a specific header pattern (Met-Gly-Trp-Cys) that the ribosome recognizes." },
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
  return (
    <section className="cta-section">
      <div className="container">
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
            <div className="footer-brand">&#x29D6; zcoin<span className="brand-dim">.bio</span></div>
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
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            <a href="#tokenomics">Tokenomics</a>
            <a href="#roadmap">Roadmap</a>
          </div>
          <div>
            <h4>Community</h4>
            <a href="https://github.com/pipikaex/biocoin" target="_blank" rel="noopener">GitHub</a>
            <a href="https://github.com/pipikaex/biocoin/discussions" target="_blank" rel="noopener">Discussions</a>
            <a href="https://github.com/pipikaex/biocoin/issues" target="_blank" rel="noopener">Issues</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} zcoin.bio &mdash; All rights reserved.</span>
          <span className="text-muted text-xs">Built with DNA, powered by SHA-256.</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */

const styles = `
/* ── Reveal animation ───────────────────── */
[data-reveal="false"] { opacity: 0; transform: translateY(30px); }
[data-reveal="true"] { opacity: 1; transform: translateY(0); transition: opacity 0.7s ease, transform 0.7s ease; }
[data-reveal="true"] .why-card,
[data-reveal="true"] .step,
[data-reveal="true"] .rm-item,
[data-reveal="true"] .persona-card {
  animation: fadeUp 0.5s ease both;
}
@keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

/* ── Gradient text ──────────────────────── */
.grad-text {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}

.landing { overflow-x: hidden; }

/* ── Generic section ────────────────────── */
.section { padding: 5rem 0; }
.section-alt { background: var(--bg-surface); }
.container { max-width: 1140px; margin: 0 auto; padding: 0 1.5rem; }
.section-header { text-align: center; margin-bottom: 3rem; }
.section-tag {
  display: inline-block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--primary); margin-bottom: 0.75rem;
  background: var(--primary-glow); padding: 0.3rem 0.9rem; border-radius: 999px;
}
.section-title { font-size: 2.5rem; font-weight: 800; line-height: 1.2; margin-bottom: 1rem; }
.section-sub { color: var(--text-muted); max-width: 600px; margin: 0 auto; line-height: 1.7; }

/* ── Hero ───────────────────────────────── */
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
}
.hero-glow {
  position: absolute; top: -200px; left: 50%; transform: translateX(-50%);
  width: 800px; height: 600px;
  background: radial-gradient(ellipse, rgba(0,229,153,0.12) 0%, transparent 70%);
  filter: blur(40px);
}
.helix-wrap {
  position: absolute; right: 8%; top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 4px; opacity: 0.35;
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

.hero-content { position: relative; z-index: 1; text-align: center; max-width: 720px; }
.hero-badge {
  display: inline-block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em;
  color: var(--primary); border: 1px solid rgba(0,229,153,0.25);
  padding: 0.35rem 1rem; border-radius: 999px; margin-bottom: 1.5rem;
}
.hero-title { font-size: 3.5rem; font-weight: 800; line-height: 1.12; margin-bottom: 1.25rem; }
.hero-sub { font-size: 1.15rem; color: var(--text-muted); line-height: 1.8; margin-bottom: 2rem; }
.hero-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin-bottom: 2rem; }
.hero-proof {
  font-size: 0.78rem; color: var(--text-dim); display: flex; gap: 0.75rem;
  justify-content: center; flex-wrap: wrap;
}
.hero-proof .sep { color: var(--border); }

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
  overflow: hidden;
}
.ticker-inner {
  display: flex; align-items: center; justify-content: center;
  gap: 1rem; font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap;
  max-width: 1140px; margin: 0 auto; padding: 0 1rem;
}
.ticker-inner b { color: var(--text); }
.ticker-inner .sep { color: var(--border); }
.pulse-dot {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: var(--success); animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ── Why cards ──────────────────────────── */
.why-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
.why-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1.75rem; transition: all 0.25s;
}
.why-card:hover { border-color: var(--primary); transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
.why-icon { font-size: 1.75rem; margin-bottom: 0.75rem; }
.why-card h3 { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.5rem; }
.why-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.7; }

/* ── Steps ──────────────────────────────── */
.steps { max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; }
.step { display: flex; gap: 1.5rem; align-items: flex-start; }
.step-n { font-family: var(--mono); font-size: 2rem; font-weight: 800; flex-shrink: 0; width: 60px; }
.step-body h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.4rem; }
.step-body p { font-size: 0.9rem; color: var(--text-muted); line-height: 1.7; }

/* ── Persona ────────────────────────────── */
.persona-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
.persona-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 2rem; transition: border-color 0.2s;
}
.persona-card:hover { border-color: var(--border-bright); }
.persona-card h3 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; }
.persona-card p { font-size: 0.88rem; color: var(--text-muted); line-height: 1.7; margin-bottom: 1rem; }

/* ── Tokenomics ─────────────────────────── */
.tok-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
.tok-card {
  text-align: center; padding: 1.75rem;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
}
.tok-val { font-family: var(--mono); font-size: 2rem; font-weight: 800; color: var(--primary); }
.tok-lbl { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem; }
.tok-explain {
  max-width: 680px; margin: 0 auto; text-align: center;
  font-size: 0.9rem; color: var(--text-muted); line-height: 1.8;
}

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
.rm-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--border); background: var(--bg); flex-shrink: 0; }
.rm-done .rm-dot { background: var(--primary); border-color: var(--primary); }
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
  transition: all 0.25s;
}
.social-card:hover { border-color: var(--primary); transform: translateY(-3px); text-decoration: none; }
.social-icon { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--primary); }
.social-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; }

/* ── FAQ ────────────────────────────────── */
.faq-list { max-width: 720px; margin: 0 auto; }
.faq-item {
  border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.5rem;
  cursor: pointer; transition: border-color 0.15s;
}
.faq-item:hover { border-color: var(--border-bright); }
.faq-open { border-color: var(--primary); }
.faq-q {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 1.25rem; font-weight: 600; font-size: 0.95rem;
}
.faq-arrow { font-size: 1.2rem; color: var(--text-muted); flex-shrink: 0; margin-left: 1rem; }
.faq-a { padding: 0 1.25rem 1rem; font-size: 0.88rem; color: var(--text-muted); line-height: 1.8; }

/* ── CTA ────────────────────────────────── */
.cta-section {
  padding: 5rem 1.5rem; text-align: center;
  background: radial-gradient(ellipse at 50% 100%, rgba(0,229,153,0.08) 0%, transparent 60%);
  border-top: 1px solid var(--border);
}
.cta-section h2 { font-size: 2.2rem; font-weight: 800; margin-bottom: 0.75rem; }
.cta-section p { color: var(--text-muted); margin-bottom: 2rem; max-width: 480px; margin-left: auto; margin-right: auto; }

/* ── Footer ─────────────────────────────── */
.site-footer {
  border-top: 1px solid var(--border); padding: 3rem 0 2rem;
  background: var(--bg-surface);
}
.footer-grid {
  display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 2rem;
  margin-bottom: 2.5rem;
}
.footer-brand { font-size: 1.2rem; font-weight: 800; margin-bottom: 0.5rem; }
.footer-grid h4 { font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.75rem; }
.footer-grid a { display: block; font-size: 0.88rem; color: var(--text-muted); padding: 0.25rem 0; text-decoration: none; }
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
}
@media (max-width: 640px) {
  .hero-title { font-size: 2.2rem; }
  .hero { min-height: auto; padding: 4rem 1rem 3rem; }
  .section { padding: 3rem 0; }
  .section-title { font-size: 1.8rem; }
  .why-grid, .persona-grid { grid-template-columns: 1fr; }
  .tok-grid { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: 1fr; }
  .footer-bottom { flex-direction: column; gap: 0.5rem; text-align: center; }
  .helix-wrap { display: none; }
}
`;
