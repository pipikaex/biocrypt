import { Link } from "react-router-dom";

interface App {
  id: string;
  title: string;
  tagline: string;
  url: string;
  color: string;
  icon: string;
  features: string[];
  status?: "live" | "beta" | "demo";
}

const APPS: App[] = [
  {
    id: "chat",
    title: "BioCrypt Chat",
    tagline: "End-to-end encrypted peer-to-peer DNA messaging.",
    url: "https://chat.biocrypt.net",
    color: "#5c9eff",
    icon: "\u{1F4AC}",
    status: "live",
    features: [
      "X25519 + XSalsa20-Poly1305 envelopes (same primitives as encrypted ZBIO transfers)",
      "Every message is serialized as a DNA strand — 4 bases per byte, fully human-readable",
      "Serverless pairing: peers discover each other over the gossip relay and talk directly",
      "Encryption keys are derived from your wallet seed — no separate account",
    ],
  },
  {
    id: "sim",
    title: "Seed Simulation",
    tagline: "Interactive DNA seed → RNA → protein playground.",
    url: "https://sim.biocrypt.net",
    color: "#00c9a7",
    icon: "\u{1F9EC}",
    status: "live",
    features: [
      "Watch a random 32-byte seed transcribe into two RNA strands",
      "See the ribosome translate codons into proteins — the same ribosome that reads your wallet",
      "Inspect the \"waist\" intergenic region where BioCrypt hides its steganographic markers",
      "Reverse: protein \u2192 RNA \u2192 DNA reconstruction, byte-perfect",
    ],
  },
  {
    id: "reel",
    title: "Protocol Reel",
    tagline: "9:16 explainer of the biological protocol, base by base.",
    url: "https://reel.biocrypt.net",
    color: "#8a82ff",
    icon: "\u{1F3AC}",
    status: "live",
    features: [
      "30-step visual walk-through of the entire BioCrypt protocol",
      "Covers DNA encoding, codon translation, DNA256 hashing, and envelope construction",
      "Designed for mobile — scroll vertically like a short-form video",
      "Perfect for sharing the idea with someone who has never seen biology math",
    ],
  },
  {
    id: "vault",
    title: "Encrypted Secret Vault",
    tagline: "Gemix-powered SDK demo: store secrets as DNA envelopes.",
    url: "https://file.biocrypt.net",
    color: "#f7b731",
    icon: "\u{1F5C4}\uFE0F",
    status: "demo",
    features: [
      "Reference integration of the @biocrypt/core SDK in a standalone app",
      "Stores encrypted notes and files as TACG-encoded DNA envelopes",
      "Open-source — clone the pattern to build your own BioCrypt-backed app",
      "Great starting point for the payment-gateway SDK as well",
    ],
  },
];

const CORE_LINKS: { id: string; label: string; to: string; icon: string; desc: string }[] = [
  { id: "wallet",   label: "Wallet",          to: "/wallet",       icon: "\u{1F9EC}", desc: "DNA-native wallet — mint, store, recover from seed phrase" },
  { id: "mine",     label: "Mine",            to: "/mine",         icon: "\u26CF\uFE0F",  desc: "Earn ZBIO with DNA256 proof-of-work (leading-T target)" },
  { id: "transfer", label: "Transfer",        to: "/transfer",     icon: "\u{1F4E8}", desc: "Send encrypted ZBIO — online, offline, or by file" },
  { id: "tracker",  label: "Coin Tracker",    to: "/tracker",      icon: "\u{1F50D}", desc: "Public minted-coin ledger with spent/unspent status" },
  { id: "network",  label: "Network Explorer", to: "/network",     icon: "\u{1F30D}", desc: "Live view of the network organism & its DNA" },
  { id: "proof",    label: "Proof",           to: "/proof",        icon: "\u{1F512}", desc: "Hands-on demo of every cryptographic layer" },
];

export function Ecosystem() {
  return (
    <div className="page eco-page">
      <header className="eco-hero">
        <h1>The BioCrypt Ecosystem</h1>
        <p>
          BioCrypt isn't just a coin &mdash; it's a family of apps sharing the same
          DNA-native cryptography. All of them run on the <Link to="/">biocrypt.net</Link>{" "}
          protocol: DNA256 proof-of-work, X25519 envelopes, and the rotating DNA ledger.
        </p>
      </header>

      <section>
        <h2 className="eco-h2">Apps</h2>
        <div className="eco-grid">
          {APPS.map((app) => (
            <a
              key={app.id}
              href={app.url}
              target="_blank"
              rel="noopener"
              className="eco-card"
              style={{ ["--eco-accent" as any]: app.color }}
            >
              <div className="eco-card-head">
                <span className="eco-icon" style={{ background: app.color + "22", color: app.color }}>
                  {app.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <h3 className="eco-card-title">{app.title}</h3>
                  <p className="eco-card-sub">{app.tagline}</p>
                </div>
                {app.status && (
                  <span className={`eco-status eco-status-${app.status}`}>{app.status}</span>
                )}
              </div>
              <ul className="eco-features">
                {app.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <div className="eco-card-foot">
                <span className="eco-domain">{new URL(app.url).hostname}</span>
                <span className="eco-open">Open &rarr;</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="eco-h2">Core App</h2>
        <p className="text-muted" style={{ maxWidth: 680, marginBottom: "1rem" }}>
          Everything you need to run ZBIO lives on this site.
        </p>
        <div className="eco-core-grid">
          {CORE_LINKS.map((l) => (
            <Link key={l.id} to={l.to} className="eco-core-card">
              <span className="eco-core-icon">{l.icon}</span>
              <div>
                <div className="eco-core-label">{l.label}</div>
                <div className="eco-core-desc">{l.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="eco-h2">What they share</h2>
        <div className="eco-shared-grid">
          <div className="eco-shared-card">
            <div className="eco-shared-icon">{"\u{1F9EA}"}</div>
            <h4>One codec</h4>
            <p>
              Every app speaks the same TACG DNA language. A coin, a chat message,
              and a vault entry are all bytes encoded as 4 bases each.
            </p>
          </div>
          <div className="eco-shared-card">
            <div className="eco-shared-icon">{"\u{1F510}"}</div>
            <h4>One keypair</h4>
            <p>
              Your BioCrypt wallet seed derives both an Ed25519 signing identity and
              an X25519 encryption identity. The same seed unlocks every app.
            </p>
          </div>
          <div className="eco-shared-card">
            <div className="eco-shared-icon">{"\u{1F680}"}</div>
            <h4>One proof</h4>
            <p>
              DNA256 proof-of-work is the anchor. When an app mentions a ZBIO coin,
              it's pointing to a receipt rooted in the same network DNA you mine against.
            </p>
          </div>
        </div>
      </section>

      <section className="eco-cta">
        <h3>Build on BioCrypt</h3>
        <p>
          All primitives live in the open-source <code>@biocrypt/core</code> package.
          Fork the vault, clone the chat, or drop the payment gateway into your own site.
        </p>
        <div className="eco-cta-btns">
          <a
            className="btn btn-primary"
            href="https://github.com/pipikaex/biocrypt"
            target="_blank"
            rel="noopener"
          >
            View Source
          </a>
          <a
            className="btn btn-secondary"
            href="https://github.com/pipikaex/biocrypt/tree/main/packages/gateway"
            target="_blank"
            rel="noopener"
          >
            Payment Gateway SDK
          </a>
          <Link className="btn btn-secondary" to="/how-it-works">
            How It Works
          </Link>
        </div>
      </section>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
.eco-page { max-width: 1140px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
.eco-hero {
  text-align: center;
  padding: 2rem 0 3rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 2.5rem;
}
.eco-hero h1 {
  font-size: 2.6rem; margin: 0 0 0.75rem;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.eco-hero p {
  color: var(--text-muted); max-width: 680px; margin: 0 auto;
  font-size: 1.05rem; line-height: 1.65;
}

.eco-h2 {
  font-size: 1.5rem; margin: 2.5rem 0 1rem;
  display: flex; align-items: center; gap: 0.6rem;
}
.eco-h2::before {
  content: ""; display: block; width: 4px; height: 22px;
  background: var(--primary); border-radius: 2px;
}

.eco-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
}
.eco-card {
  display: flex; flex-direction: column; gap: 0.9rem;
  padding: 1.4rem 1.4rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-decoration: none; color: var(--text);
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  position: relative; overflow: hidden;
}
.eco-card::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 3px;
  background: var(--eco-accent, var(--primary));
  opacity: 0.75;
}
.eco-card:hover {
  border-color: var(--eco-accent, var(--primary));
  box-shadow: 0 10px 40px -20px var(--eco-accent, var(--primary));
  transform: translateY(-2px);
  text-decoration: none;
}
.eco-card-head { display: flex; align-items: flex-start; gap: 0.85rem; }
.eco-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}
.eco-card-title { margin: 0; font-size: 1.1rem; }
.eco-card-sub { margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; }
.eco-status {
  text-transform: uppercase;
  font-size: 0.62rem; letter-spacing: 0.08em; font-weight: 700;
  padding: 0.2rem 0.5rem; border-radius: 4px;
  background: var(--primary-glow); color: var(--primary);
  align-self: flex-start;
}
.eco-status-demo { background: rgba(247,183,49,0.18); color: #f7b731; }
.eco-status-beta { background: rgba(92,158,255,0.18); color: #5c9eff; }

.eco-features {
  margin: 0; padding: 0 0 0 1rem;
  font-size: 0.8rem; line-height: 1.55;
  color: var(--text-muted);
}
.eco-features li { margin-bottom: 0.35rem; }
.eco-features li::marker { color: var(--eco-accent, var(--primary)); }

.eco-card-foot {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border);
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.78rem;
}
.eco-domain { font-family: var(--mono); color: var(--text-muted); }
.eco-open { font-weight: 600; color: var(--eco-accent, var(--primary)); }

.eco-core-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.85rem;
}
.eco-core-card {
  display: flex; gap: 0.85rem; align-items: flex-start;
  padding: 0.95rem 1.1rem;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius);
  text-decoration: none; color: var(--text);
  transition: border-color 0.2s, transform 0.2s;
}
.eco-core-card:hover {
  border-color: var(--primary);
  transform: translateX(2px);
  text-decoration: none;
}
.eco-core-icon {
  font-size: 1.4rem;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: var(--primary-glow); border-radius: 10px;
  flex-shrink: 0;
}
.eco-core-label { font-weight: 600; margin-bottom: 0.15rem; }
.eco-core-desc { font-size: 0.78rem; color: var(--text-muted); line-height: 1.45; }

.eco-shared-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}
.eco-shared-card {
  padding: 1.1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.eco-shared-icon { font-size: 1.6rem; margin-bottom: 0.4rem; }
.eco-shared-card h4 { margin: 0 0 0.4rem; font-size: 1rem; }
.eco-shared-card p {
  margin: 0; color: var(--text-muted);
  font-size: 0.85rem; line-height: 1.55;
}

.eco-cta {
  text-align: center;
  padding: 2.5rem 1.5rem;
  margin-top: 3rem;
  background: linear-gradient(135deg, var(--primary-glow), transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.eco-cta h3 { font-size: 1.6rem; margin: 0 0 0.6rem; }
.eco-cta p {
  max-width: 520px; margin: 0 auto 1.25rem;
  color: var(--text-muted); line-height: 1.6;
}
.eco-cta-btns {
  display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap;
}
.eco-cta code {
  background: var(--bg-surface); padding: 0.12rem 0.4rem;
  border-radius: 4px; font-size: 0.88em;
}
`;
