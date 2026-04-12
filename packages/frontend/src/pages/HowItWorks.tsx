import { useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ProteinBar } from "../ProteinBar";
import { useReveal } from "../hooks/useReveal";

const EXAMPLE_COIN_AA = ["Met","Gly","Trp","Cys","Ala","Leu","Ser","Pro","Thr","Val","Ile","Phe","Tyr","His","Gln","Asn","Lys","Asp","Glu","Arg","Cys","Trp","Gly"];
const EXAMPLE_WALLET_AA = ["Met","Ser","Val","Ile","Pro","Ala","Leu","Gly","Thr","Phe","Cys","His","Trp","Arg","Asp","Glu","Lys","Asn","Gln","Tyr"];

function useParallax() {
  const ref = useRef<HTMLDivElement>(null);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = (vh - r.top) / (vh + r.height);
    el.style.setProperty("--px", `${(progress - 0.5) * 40}px`);
  }, []);
  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);
  return ref;
}

function HiwHelix({ side = "left", top = "10%" }: { side?: "left" | "right"; top?: string }) {
  return (
    <div className={`hiw-side-helix hiw-helix-${side}`} style={{ top }} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} className="hiw-sh-rung" style={{ animationDelay: `${i * 0.18}s` }}>
          <span className="hiw-sh-dot hiw-sh-l" />
          <span className="hiw-sh-bar" />
          <span className="hiw-sh-dot hiw-sh-r" />
        </div>
      ))}
    </div>
  );
}

export function HowItWorks() {
  return (
    <div className="hiw-page">
      {/* Hero */}
      <section className="hiw-hero">
        <div className="hiw-hero-glow" />
        <HiwHelix side="right" top="20%" />
        <div className="hiw-container">
          <div className="hiw-tag">Architecture</div>
          <h1 className="hiw-title">
            How <span className="hiw-grad">zBioCoin</span> Works
          </h1>
          <p className="hiw-sub">
            A cryptocurrency where wallets are DNA, coins are proteins, transfers are mRNA, 
            and double-spend protection is an immune system. Ed25519 signatures encoded as DNA 
            let any wallet verify any coin offline &mdash; even if the network server disappears.
          </p>
        </div>
      </section>

      {/* Overview Flow */}
      <section className="hiw-section">
        <div className="hiw-container">
          <div className="hiw-flow">
            <FlowStep num={1} icon={"\u{1F9EC}"} label="Create Wallet" color="var(--primary)" />
            <FlowArrow />
            <FlowStep num={2} icon={"\u26CF\uFE0F"} label="Mine Coins" color="#3b82f6" />
            <FlowArrow />
            <FlowStep num={3} icon={"\u{1F58A}\uFE0F"} label="Network Signs" color="#a855f7" />
            <FlowArrow />
            <FlowStep num={4} icon={"\u{1F4E8}"} label="Transfer" color="#f97316" />
            <FlowArrow />
            <FlowStep num={5} icon={"\u{1F6E1}\uFE0F"} label="Anti-Double-Spend" color="#ef4444" />
          </div>
        </div>
      </section>

      {/* 1. DNA Wallets */}
      <HiwRevealSection alt>
        <div className="hiw-container">
          <HiwHelix side="left" top="5%" />
          <div className="hiw-split">
            <div className="hiw-text">
              <div className="hiw-step-badge" style={{ background: "var(--primary)" }}>Step 1</div>
              <h2>Wallets Are DNA Strands</h2>
              <p>
                Your wallet is a strand of 6,000+ DNA bases (T, A, C, G) — randomly generated 
                in your browser. It never leaves your device.
              </p>
              <p>
                A <strong>ribosome function</strong> reads this DNA using the real human codon table, 
                translating 3-letter codes (codons) into amino acids. The resulting protein chain 
                becomes your <strong>public key</strong>.
              </p>
              <p>
                Your <strong>private key</strong> is a separate DNA strand. When combined with your 
                wallet DNA through hybridization, it produces a unique "unlocking protein" that 
                proves ownership &mdash; just like a biological key fitting a lock.
              </p>
              <p>
                At creation, your wallet also receives the <strong>Network Genome</strong> &mdash; a 128-base 
                DNA sequence encoding the network's Ed25519 public key. This lets your wallet 
                verify any coin's authenticity offline, forever, like every cell carrying your body's MHC markers.
              </p>
            </div>
            <div className="hiw-visual">
              <div className="hiw-card-dark">
                <div className="hiw-card-label">Wallet DNA</div>
                <div className="hiw-dna-strand">
                  ATGCGATCGATTACGGTACGATCGATTACG<br/>
                  CGTAATCGATCGCATGCGATCGACGTACGA<br/>
                  TCGATCGCATGCGATCGATTACGGCGATCG...
                </div>
                <div className="hiw-arrow-down">{"\u2193"}</div>
                <div className="hiw-card-label">Ribosome reads codons</div>
                <div className="hiw-codon-row">
                  <span className="hiw-codon">ATG</span>
                  <span className="hiw-codon-eq">{"\u2192"}</span>
                  <span className="hiw-aa">Met</span>
                  <span className="hiw-codon">GGG</span>
                  <span className="hiw-codon-eq">{"\u2192"}</span>
                  <span className="hiw-aa">Gly</span>
                  <span className="hiw-codon">TGG</span>
                  <span className="hiw-codon-eq">{"\u2192"}</span>
                  <span className="hiw-aa">Trp</span>
                </div>
                <div className="hiw-arrow-down">{"\u2193"}</div>
                <div className="hiw-card-label">Protein Chain = Public Key</div>
                <ProteinBar aminoAcids={EXAMPLE_WALLET_AA} height={16} />
              </div>
            </div>
          </div>
        </div>
      </HiwRevealSection>

      {/* 2. Mining */}
      <HiwRevealSection>
        <div className="hiw-container">
          <div className="hiw-split hiw-split-reverse">
            <div className="hiw-text">
              <div className="hiw-step-badge" style={{ background: "#3b82f6" }}>Step 2</div>
              <h2>Mining = Protein Synthesis + Proof-of-Work</h2>
              <p>
                Mining creates new coins. Each coin is a <strong>DNA gene</strong> starting 
                with the coin header <code>ATGGGGTGGTGC</code> (which translates to Met-Gly-Trp-Cys), 
                followed by a random body and a nonce.
              </p>
              <p>
                The miner must find a nonce such that:<br/>
                <code className="hiw-formula">SHA-256(gene + "|" + nonce) {"<="} difficulty target</code>
              </p>
              <p>
                This is <strong>identical to Bitcoin's proof-of-work</strong> &mdash; the same SHA-256 hash 
                function, the same difficulty adjustment, the same computational guarantee. 
                Each coin's 180-base body produces ~60 amino acids, giving <strong>259 bits of entropy</strong> &mdash;
                more collision-resistant than SHA-256 itself. Nobody can create coins for free.
              </p>
            </div>
            <div className="hiw-visual">
              <div className="hiw-card-dark">
                <div className="hiw-card-label">Coin Gene (DNA)</div>
                <div className="hiw-dna-strand" style={{ color: "#22c55e" }}>
                  ATGGGGTGGTGC<span style={{ color: "var(--text-muted)" }}>GCTACGTTACCC<br/>GTTGAGGTCTAT...GCTGCT</span>TAA
                </div>
                <div className="hiw-arrow-down">{"\u2193"}</div>
                <div className="hiw-card-label">Proof-of-Work</div>
                <div className="hiw-pow-box">
                  <div className="hiw-pow-line">
                    <span className="text-muted">nonce:</span> <span className="mono">158,859</span>
                  </div>
                  <div className="hiw-pow-line">
                    <span className="text-muted">hash:</span> <span className="mono"><span style={{ color: "#22c55e" }}>00000</span>8ea12dabe1...</span>
                  </div>
                  <div className="hiw-pow-line">
                    <span className="text-muted">target:</span> <span className="mono">5 leading zeros</span>
                  </div>
                </div>
                <div className="hiw-arrow-down">{"\u2193"}</div>
                <div className="hiw-card-label">Coin Protein (unique fingerprint)</div>
                <ProteinBar aminoAcids={EXAMPLE_COIN_AA} height={16} />
              </div>
            </div>
          </div>
        </div>
      </HiwRevealSection>

      {/* 3. Network Signing */}
      <HiwRevealSection alt>
        <div className="hiw-container">
          <HiwHelix side="right" top="10%" />
          <div className="hiw-split">
            <div className="hiw-text">
              <div className="hiw-step-badge" style={{ background: "#a855f7" }}>Step 3</div>
              <h2>Network Signing &mdash; Ed25519 as DNA</h2>
              <p>
                The zBioCoin network has an <strong>Ed25519 keypair encoded as DNA</strong>. The private key 
                (128 bases) is the "reproductive DNA" &mdash; only the server has it. The public key 
                (128 bases) is the "Network Genome" &mdash; shared with every wallet.
              </p>
              <ol className="hiw-list">
                <li><strong>Verifies</strong> your proof-of-work + checks for duplicate coin serial hashes</li>
                <li><strong>Signs</strong> with Ed25519: <code>Ed25519.sign(serialHash + networkId, privateKeyDNA)</code></li>
                <li><strong>Generates</strong> parentage marker DNA &mdash; a separate strand with restriction enzyme sites derived from the private key + coin serial, like mitochondrial DNA inherited from the mother</li>
                <li><strong>Mutates</strong> its own DNA by splicing the coin gene into the network strand</li>
              </ol>
              <p>
                Two independent proofs travel with every coin: a 256-base Ed25519 signature (mathematical)
                and an RFLP fingerprint (biological). Any wallet can verify both offline using the Network 
                Genome. <strong>No server needed.</strong> If the server disappears, your coins remain 
                provably valid and tradeable forever.
              </p>
            </div>
            <div className="hiw-visual">
              <div className="hiw-diagram-signing">
                <div className="hiw-diagram-node hiw-node-miner">
                  <div className="hiw-node-icon">{"\u26CF\uFE0F"}</div>
                  <div className="hiw-node-label">Your Miner</div>
                </div>
                <div className="hiw-diagram-arrow">{"\u2192"} submit coin</div>
                <div className="hiw-diagram-node hiw-node-network">
                  <div className="hiw-node-icon">{"\u{1F9EC}"}</div>
                  <div className="hiw-node-label">Network</div>
                  <div className="hiw-node-sub">Verify PoW + Ed25519 Sign + Mutate DNA</div>
                </div>
                <div className="hiw-diagram-arrow">{"\u2192"} signed coin + genome</div>
                <div className="hiw-diagram-node hiw-node-wallet">
                  <div className="hiw-node-icon">{"\u{1F4B3}"}</div>
                  <div className="hiw-node-label">Your Wallet</div>
                  <div className="hiw-node-sub">Coin verifiable offline forever</div>
                </div>
              </div>
              <div className="hiw-card-dark" style={{ marginTop: "1.25rem" }}>
                <div className="hiw-card-label">Defense in Depth: Two Proofs per Coin</div>
                <div className="hiw-pow-box">
                  <div className="hiw-pow-line">
                    <span className="text-muted">1. Ed25519 Signature:</span> <span className="mono" style={{ color: "#22c55e" }}>256-base DNA &mdash; mathematical proof (256-bit security)</span>
                  </div>
                  <div className="hiw-pow-line">
                    <span className="text-muted">2. RFLP Fingerprint:</span> <span className="mono" style={{ color: "#a855f7" }}>Restriction enzyme gel bands &mdash; biological proof of parentage</span>
                  </div>
                  <div className="hiw-pow-line">
                    <span className="text-muted">Enzymes:</span> <span className="mono">EcoRI (GAATTC) &middot; BamHI (GGATCC) &middot; HindIII (AAGCTT) &middot; PstI (CTGCAG) &middot; SalI (GTCGAC)</span>
                  </div>
                  <div className="hiw-pow-line">
                    <span className="text-muted">Verification:</span> <span className="mono">Offline with Network Genome &mdash; like a forensic paternity test</span>
                  </div>
                </div>
              </div>
              <div className="hiw-card-dark" style={{ marginTop: "0.75rem" }}>
                <div className="hiw-card-label">Gel Electrophoresis (Parentage Test)</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", lineHeight: 1.8, color: "var(--text-muted)" }}>
                  <div>Network: <span style={{ color: "#a855f7" }}>{"\u2588\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "#a855f7" }}>{"\u2588\u2588"}</span>{"  "}<span style={{ color: "#a855f7" }}>{"\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "#a855f7" }}>{"\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "#a855f7" }}>{"\u2588\u2588\u2588\u2588\u2588"}</span></div>
                  <div>Coin A:{"  "}<span style={{ color: "#22c55e" }}>{"\u2588\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "#22c55e" }}>{"\u2588\u2588"}</span>{"    "}<span style={{ color: "#22c55e" }}>{"\u2588\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "#22c55e" }}>{"\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "#22c55e" }}>{"\u2588\u2588\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "var(--primary)" }}>{"\u2190 shares bands \u2192 VALID \u2713"}</span></div>
                  <div>Coin B:{"  "}<span style={{ color: "#ef4444" }}>{"\u2588\u2588\u2588\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "#ef4444" }}>{"\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "#ef4444" }}>{"\u2588\u2588\u2588\u2588\u2588\u2588"}</span>{"  "}<span style={{ color: "#ef4444" }}>{"\u2588\u2588"}</span>{"        "}<span style={{ color: "#ef4444" }}>{"\u2190 no match \u2192 FORGERY \u2717"}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HiwRevealSection>

      {/* 4. Transfers */}
      <HiwRevealSection>
        <div className="hiw-container">
          <div className="hiw-split hiw-split-reverse">
            <div className="hiw-text">
              <div className="hiw-step-badge" style={{ background: "#f97316" }}>Step 4</div>
              <h2>Transfers via mRNA — Even Offline</h2>
              <p>
                To send a coin, your wallet:
              </p>
              <ol className="hiw-list">
                <li><strong>Extracts</strong> the coin gene from your DNA (it's gone from your wallet)</li>
                <li><strong>Computes a nullifier</strong> from your private key — a unique "spent" marker</li>
                <li><strong>Wraps everything</strong> in an mRNA payload (JSON file)</li>
              </ol>
              <p>
                The recipient <strong>splices</strong> the gene into their DNA. The mRNA file 
                contains everything needed — no server required. Send it via email, USB stick, 
                QR code, or carrier pigeon.
              </p>
              <p className="hiw-highlight">
                This is true peer-to-peer transfer. Works completely offline.
              </p>
            </div>
            <div className="hiw-visual">
              <div className="hiw-transfer-diagram">
                <div className="hiw-transfer-step">
                  <div className="hiw-transfer-icon" style={{ background: "rgba(249,115,22,0.15)" }}>{"\u{1F9EC}"}</div>
                  <div>Sender DNA</div>
                  <div className="hiw-transfer-detail">Contains coin gene</div>
                </div>
                <div className="hiw-transfer-arrow">{"\u2193"} extract gene</div>
                <div className="hiw-transfer-step">
                  <div className="hiw-transfer-icon" style={{ background: "rgba(168,85,247,0.15)" }}>{"\u2702\uFE0F"}</div>
                  <div>Create mRNA</div>
                  <div className="hiw-transfer-detail">Gene + proof + nullifier</div>
                </div>
                <div className="hiw-transfer-arrow">{"\u2193"} send file</div>
                <div className="hiw-transfer-step">
                  <div className="hiw-transfer-icon" style={{ background: "rgba(59,130,246,0.15)" }}>{"\u{1F4E8}"}</div>
                  <div>mRNA Payload</div>
                  <div className="hiw-transfer-detail">Email / USB / QR / Offline</div>
                </div>
                <div className="hiw-transfer-arrow">{"\u2193"} splice into DNA</div>
                <div className="hiw-transfer-step">
                  <div className="hiw-transfer-icon" style={{ background: "rgba(0,229,153,0.15)" }}>{"\u{1F4B3}"}</div>
                  <div>Recipient DNA</div>
                  <div className="hiw-transfer-detail">Coin is now theirs</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HiwRevealSection>

      {/* 5. Anti-Double-Spend */}
      <HiwRevealSection alt>
        <div className="hiw-container">
          <HiwHelix side="left" top="15%" />
          <div className="hiw-split">
            <div className="hiw-text">
              <div className="hiw-step-badge" style={{ background: "#ef4444" }}>Step 5</div>
              <h2>The Immune System &mdash; Multi-Layer Defense</h2>
              <p>
                How do we prevent forgery and double-spending without a blockchain?
                The same way your body fights infection: <strong>multiple overlapping defenses</strong>.
              </p>
              <ol className="hiw-list">
                <li>
                  <strong>Duplicate coin check:</strong> The network tracks every serial hash ever signed.
                  Submit the same coin twice? Rejected instantly.
                </li>
                <li>
                  <strong>Nullifier commitment:</strong> When you spend a coin, a deterministic nullifier is computed:<br/>
                  <code>SHA-256(coinSerialHash + "|nullifier|" + SHA-256(privateKey))</code><br/>
                  Same coin + same owner = always the same nullifier. Spend it twice? Registry rejects it.
                </li>
                <li>
                  <strong>Ed25519 signature verification:</strong> Every mRNA transfer validates the coin's
                  network signature using the Ed25519 public key. Forged signatures fail instantly.
                </li>
                <li>
                  <strong>Proof-of-work enforcement:</strong> Every transfer validates the coin's mining proof.
                  No valid PoW? The coin is rejected even in offline mode.
                </li>
              </ol>
            </div>
            <div className="hiw-visual">
              <div className="hiw-immune-diagram">
                <div className="hiw-immune-row">
                  <div className="hiw-immune-node hiw-immune-ok">
                    <div className="hiw-immune-icon">{"\u2705"}</div>
                    <div><strong>First spend</strong></div>
                    <div className="text-xs text-muted">Nullifier recorded</div>
                  </div>
                  <div className="hiw-immune-node hiw-immune-reject">
                    <div className="hiw-immune-icon">{"\u274C"}</div>
                    <div><strong>Second spend</strong></div>
                    <div className="text-xs text-muted">Nullifier exists = REJECTED</div>
                  </div>
                </div>
                <div className="hiw-immune-formula">
                  <code>nullifier = SHA-256(coinHash + "|nullifier|" + SHA-256(privateKey))</code>
                </div>
                <div className="hiw-immune-props">
                  <div className="hiw-prop">
                    <span className="hiw-prop-icon">{"\u{1F512}"}</span>
                    <span>Ed25519 signature: 256-bit asymmetric security</span>
                  </div>
                  <div className="hiw-prop">
                    <span className="hiw-prop-icon">{"\u{1F6E1}\uFE0F"}</span>
                    <span>Duplicate serial hash rejection on submit</span>
                  </div>
                  <div className="hiw-prop">
                    <span className="hiw-prop-icon">{"\u{1F575}\uFE0F"}</span>
                    <span>Nullifier reveals nothing about private key</span>
                  </div>
                  <div className="hiw-prop">
                    <span className="hiw-prop-icon">{"\u26A1"}</span>
                    <span>Offline verification with Network Genome</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HiwRevealSection>

      {/* Comparison Table */}
      <HiwRevealSection>
        <div className="hiw-container">
          <div className="hiw-header">
            <div className="hiw-tag">Comparison</div>
            <h2 className="hiw-section-title">zBioCoin vs. Bitcoin vs. Traditional Crypto</h2>
          </div>
          <div className="hiw-table-wrap">
            <table className="hiw-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Bitcoin</th>
                  <th>Typical Altcoin</th>
                  <th className="hiw-table-highlight">zBioCoin</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Proof-of-Work</td><td>SHA-256</td><td>Various</td><td className="hiw-table-highlight">SHA-256 (identical)</td></tr>
                <tr><td>Signing</td><td>ECDSA</td><td>Various</td><td className="hiw-table-highlight">Ed25519 encoded as DNA</td></tr>
                <tr><td>Ledger</td><td>Blockchain</td><td>Blockchain/DAG</td><td className="hiw-table-highlight">No ledger &mdash; nullifier registry</td></tr>
                <tr><td>Offline transfers</td><td>No</td><td>No</td><td className="hiw-table-highlight">Yes &mdash; mRNA payloads</td></tr>
                <tr><td>Offline verification</td><td>No (needs nodes)</td><td>No</td><td className="hiw-table-highlight">Yes &mdash; Network Genome in every wallet</td></tr>
                <tr><td>Storage</td><td>Every node stores all txns</td><td>Full chain</td><td className="hiw-table-highlight">Only nullifiers + network DNA</td></tr>
                <tr><td>Coin identity</td><td>UTXO hash</td><td>Token ID</td><td className="hiw-table-highlight">180-base gene &rarr; protein fingerprint (259 bits)</td></tr>
                <tr><td>Wallet format</td><td>Seed phrase</td><td>Seed phrase</td><td className="hiw-table-highlight">DNA strand (TACG bases)</td></tr>
                <tr><td>Double-spend prevention</td><td>6 confirmations</td><td>Confirmations</td><td className="hiw-table-highlight">Instant nullifier + duplicate serial check</td></tr>
                <tr><td>Private key exposure</td><td>Signs transactions</td><td>Signs transactions</td><td className="hiw-table-highlight">Never leaves client &mdash; one-time export only</td></tr>
                <tr><td>Visual verification</td><td>None</td><td>None</td><td className="hiw-table-highlight">RFLP gel electrophoresis &mdash; see proof of parentage</td></tr>
                <tr><td>Coins without server</td><td>Need network</td><td>Need network</td><td className="hiw-table-highlight">Self-validating forever via Ed25519 + RFLP</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </HiwRevealSection>

      {/* CTA */}
      <section className="hiw-section hiw-alt">
        <div className="hiw-container" style={{ textAlign: "center" }}>
          <h2 className="hiw-section-title">Ready to Try It?</h2>
          <p className="hiw-sub" style={{ marginBottom: "2rem" }}>
            Create a wallet in 2 seconds. Mine your first coin in under a minute. No signup, no downloads.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/mine" className="btn btn-primary btn-lg">Start Mining</Link>
            <Link to="/wallet" className="btn btn-secondary btn-lg">Create Wallet</Link>
            <Link to="/network" className="btn btn-ghost btn-lg">View Network</Link>
          </div>
        </div>
      </section>

      <style>{hiwStyles}</style>
    </div>
  );
}

function HiwRevealSection({ children, alt = false }: { children: React.ReactNode; alt?: boolean }) {
  const r = useReveal(0.1);
  const px = useParallax();
  return (
    <section
      className={`hiw-section hiw-reveal-section ${alt ? "hiw-alt" : ""}`}
      ref={(el: HTMLDivElement | null) => {
        (r.ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        (px as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      data-hiw-reveal={r.visible}
    >
      {children}
    </section>
  );
}

function FlowStep({ num, icon, label, color }: { num: number; icon: string; label: string; color: string }) {
  return (
    <div className="hiw-flow-step">
      <div className="hiw-flow-circle" style={{ borderColor: color, boxShadow: `0 0 20px ${color}33` }}>
        <span className="hiw-flow-icon">{icon}</span>
      </div>
      <div className="hiw-flow-num" style={{ color }}>{num}</div>
      <div className="hiw-flow-label">{label}</div>
    </div>
  );
}

function FlowArrow() {
  return <div className="hiw-flow-arrow">{"\u2192"}</div>;
}

const hiwStyles = `
.hiw-page { overflow-x: hidden; }

/* ── Reveal animation ──────────────────── */
[data-hiw-reveal="false"] { opacity: 0; transform: translateY(36px); }
[data-hiw-reveal="true"] { opacity: 1; transform: translateY(0); transition: opacity 0.8s ease, transform 0.8s ease; }
[data-hiw-reveal="true"] .hiw-split > .hiw-text { animation: hiwSlideIn 0.7s ease both; }
[data-hiw-reveal="true"] .hiw-split > .hiw-visual { animation: hiwSlideIn 0.7s ease 0.15s both; }
[data-hiw-reveal="true"] .hiw-split-reverse > .hiw-text { animation: hiwSlideIn 0.7s ease 0.15s both; }
[data-hiw-reveal="true"] .hiw-split-reverse > .hiw-visual { animation: hiwSlideIn 0.7s ease both; }
@keyframes hiwSlideIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

.hiw-reveal-section { position: relative; overflow: hidden; }

/* ── Side helix decorations ────────────── */
.hiw-side-helix {
  position: absolute; z-index: 0; opacity: 0.15;
  display: flex; flex-direction: column; gap: 5px;
  pointer-events: none;
}
.hiw-helix-left { left: 1.5%; }
.hiw-helix-right { right: 1.5%; }
.hiw-sh-rung {
  display: flex; align-items: center; gap: 3px;
  animation: hiwShPulse 5s ease-in-out infinite alternate;
}
.hiw-sh-dot { width: 5px; height: 5px; border-radius: 50%; }
.hiw-sh-dot.hiw-sh-l { background: #f85149; }
.hiw-sh-dot.hiw-sh-r { background: #3fb950; }
.hiw-sh-bar { width: 32px; height: 1.5px; background: var(--border); }
@keyframes hiwShPulse {
  0% { transform: scaleX(0.3) translateX(-4px); opacity: 0.3; }
  50% { transform: scaleX(1.4) translateX(0); opacity: 1; }
  100% { transform: scaleX(0.3) translateX(4px); opacity: 0.3; }
}

/* Hero */
.hiw-hero {
  padding: 5rem 0 3rem;
  text-align: center;
  background: linear-gradient(180deg, rgba(0,229,153,0.04) 0%, transparent 100%);
  border-bottom: 1px solid var(--border);
  position: relative; overflow: hidden;
}
.hiw-hero-glow {
  position: absolute; top: -150px; left: 50%; transform: translateX(-50%);
  width: 600px; height: 400px;
  background: radial-gradient(ellipse, rgba(0,229,153,0.1) 0%, transparent 70%);
  filter: blur(50px);
  animation: hiwGlowBreathe 6s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes hiwGlowBreathe {
  0% { opacity: 0.6; transform: translateX(-50%) scale(0.9); }
  100% { opacity: 1; transform: translateX(-50%) scale(1.1); }
}
.hiw-container { max-width: 1140px; margin: 0 auto; padding: 0 1.5rem; }
.hiw-tag {
  display: inline-block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--primary); margin-bottom: 0.75rem;
  background: var(--primary-glow); padding: 0.3rem 0.9rem; border-radius: 999px;
}
.hiw-title { font-size: 3rem; font-weight: 800; line-height: 1.1; margin-bottom: 1.25rem; }
.hiw-grad {
  background: linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.hiw-sub { color: var(--text-muted); max-width: 640px; margin: 0 auto; line-height: 1.7; font-size: 1.05rem; }

/* Overview Flow */
.hiw-flow {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  flex-wrap: wrap; padding: 1rem 0;
}
.hiw-flow-step { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; min-width: 90px; }
.hiw-flow-circle {
  width: 64px; height: 64px; border-radius: 50%;
  border: 2px solid var(--primary);
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-card);
  transition: transform 0.3s, box-shadow 0.3s;
}
.hiw-flow-step:hover .hiw-flow-circle {
  transform: scale(1.12);
  box-shadow: 0 0 25px rgba(0,229,153,0.3);
}
.hiw-flow-icon { font-size: 1.5rem; }
.hiw-flow-num { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; }
.hiw-flow-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-align: center; }
.hiw-flow-arrow {
  font-size: 1.5rem; color: var(--text-muted); padding: 0 0.25rem; margin-top: -1.5rem;
  animation: arrowBounce 2s ease-in-out infinite;
}
@keyframes arrowBounce {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(5px); }
}

/* Sections */
.hiw-section { padding: 4.5rem 0; }
.hiw-alt { background: var(--bg-surface); }
.hiw-header { text-align: center; margin-bottom: 3rem; }
.hiw-section-title { font-size: 2rem; font-weight: 800; margin-bottom: 0.75rem; }

/* Split layout */
.hiw-split { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
.hiw-split-reverse .hiw-text { order: 2; }
.hiw-split-reverse .hiw-visual { order: 1; }
.hiw-text h2 { font-size: 1.75rem; font-weight: 800; margin-bottom: 1rem; }
.hiw-text p { color: var(--text-muted); line-height: 1.7; margin-bottom: 1rem; }
.hiw-text code { background: var(--bg-card); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
.hiw-step-badge {
  display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px;
  font-size: 0.7rem; font-weight: 700; color: var(--bg); margin-bottom: 1rem;
  letter-spacing: 0.05em; text-transform: uppercase;
}
.hiw-list { color: var(--text-muted); line-height: 1.8; padding-left: 1.25rem; margin-bottom: 1rem; }
.hiw-list li { margin-bottom: 0.5rem; }
.hiw-highlight {
  background: rgba(0,229,153,0.08); border-left: 3px solid var(--primary);
  padding: 0.75rem 1rem; border-radius: 0 var(--radius) var(--radius) 0;
  font-weight: 500; color: var(--text);
}

/* Dark cards */
.hiw-card-dark {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
  padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.hiw-card-dark:hover { border-color: var(--primary); box-shadow: 0 0 20px rgba(0,229,153,0.08); }
.hiw-card-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.hiw-dna-strand { font-family: var(--mono); font-size: 0.75rem; color: var(--primary); word-break: break-all; line-height: 1.6; }
.hiw-arrow-down { text-align: center; font-size: 1.25rem; color: var(--text-muted); }
.hiw-codon-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.hiw-codon { font-family: var(--mono); font-size: 0.8rem; color: var(--primary); background: rgba(0,229,153,0.1); padding: 0.2rem 0.5rem; border-radius: 4px; }
.hiw-codon-eq { color: var(--text-muted); font-size: 0.75rem; }
.hiw-aa { font-family: var(--mono); font-size: 0.8rem; font-weight: 600; color: var(--text); }
.hiw-formula { font-family: var(--mono); font-size: 0.85rem; background: var(--bg-card); padding: 0.5rem 1rem; border-radius: 6px; display: inline-block; }

/* PoW box */
.hiw-pow-box { display: flex; flex-direction: column; gap: 0.35rem; }
.hiw-pow-line { font-size: 0.8rem; display: flex; gap: 0.5rem; }

/* Signing diagram */
.hiw-diagram-signing {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; justify-content: center;
}
.hiw-diagram-node {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
  padding: 1.25rem 1rem; text-align: center; min-width: 100px;
}
.hiw-node-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
.hiw-node-label { font-weight: 700; font-size: 0.85rem; }
.hiw-node-sub { font-size: 0.65rem; color: var(--text-muted); margin-top: 0.25rem; }
.hiw-node-miner { border-color: rgba(59,130,246,0.4); }
.hiw-node-network { border-color: rgba(168,85,247,0.4); background: rgba(168,85,247,0.05); }
.hiw-node-wallet { border-color: rgba(0,229,153,0.4); }
.hiw-diagram-arrow { font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; }

/* Transfer diagram */
.hiw-transfer-diagram { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
.hiw-transfer-step {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
  padding: 1rem 1.5rem; text-align: center; width: 100%; max-width: 280px;
  font-weight: 600; font-size: 0.9rem;
}
.hiw-transfer-icon { width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.2rem; margin-bottom: 0.5rem; }
.hiw-transfer-detail { font-size: 0.7rem; color: var(--text-muted); font-weight: 400; margin-top: 0.25rem; }
.hiw-transfer-arrow { font-size: 0.75rem; color: var(--text-muted); padding: 0.15rem 0; }

/* Immune diagram */
.hiw-immune-diagram { display: flex; flex-direction: column; gap: 1.25rem; align-items: center; }
.hiw-immune-row { display: flex; gap: 1.5rem; justify-content: center; }
.hiw-immune-node {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
  padding: 1.25rem 1.5rem; text-align: center; min-width: 140px;
}
.hiw-immune-ok { border-color: rgba(0,229,153,0.4); }
.hiw-immune-reject { border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.04); }
.hiw-immune-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
.hiw-immune-formula {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
  padding: 0.75rem 1rem; font-size: 0.7rem; text-align: center; width: 100%; max-width: 500px;
}
.hiw-immune-formula code { font-size: 0.7rem; word-break: break-all; }
.hiw-immune-props { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; max-width: 400px; }
.hiw-prop {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.85rem; color: var(--text-muted);
}
.hiw-prop-icon { font-size: 1rem; }

/* Comparison table */
.hiw-table-wrap { overflow-x: auto; }
.hiw-table {
  width: 100%; border-collapse: collapse; font-size: 0.85rem;
}
.hiw-table th, .hiw-table td {
  padding: 0.75rem 1rem; text-align: left;
  border-bottom: 1px solid var(--border);
}
.hiw-table th {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-muted); font-weight: 600; background: var(--bg-card);
}
.hiw-table td { color: var(--text-muted); }
.hiw-table-highlight {
  color: var(--primary) !important; font-weight: 600;
  background: rgba(0,229,153,0.04);
}

/* Responsive */
@media (max-width: 900px) {
  .hiw-side-helix { display: none; }
}
@media (max-width: 768px) {
  .hiw-title { font-size: 2rem; }
  .hiw-split { grid-template-columns: 1fr; gap: 2rem; }
  .hiw-split-reverse .hiw-text { order: 1; }
  .hiw-split-reverse .hiw-visual { order: 2; }
  .hiw-flow-arrow { display: none; }
  .hiw-flow { gap: 1rem; }
  .hiw-diagram-signing { flex-direction: column; }
  .hiw-immune-row { flex-direction: column; align-items: center; }
  .hiw-section { padding: 3rem 0; }
  .hiw-side-helix { display: none; }
}
`;
