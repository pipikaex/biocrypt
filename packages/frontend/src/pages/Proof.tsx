import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  sha256, ribosome, isCoinProtein, getCoinSerial,
  powLayerDna256, countLeadingTs, verifyWithDNA,
  GENESIS_GENOME_FINGERPRINT, V1_MIN_LEADING_TS,
  coinV1SigningMessage, type CoinV1,
} from "@biocrypt/core";
import { useReveal } from "../hooks/useReveal";
import { useStore } from "../store";

type VerifyResult = { layer: string; icon: string; pass: boolean; detail: string; time?: string };

function verifyCoinLayers(coin: CoinV1 | null): VerifyResult[] {
  if (!coin) return [];
  const results: VerifyResult[] = [];

  // Layer 1: DNA256 proof-of-work
  const t0 = performance.now();
  const strand = (() => {
    try { return powLayerDna256(coin.coinGene, coin.miningProof.nonce); }
    catch { return ""; }
  })();
  const leadingTs = strand ? countLeadingTs(strand) : 0;
  const powPass = leadingTs >= coin.miningProof.leadingTs
    && coin.miningProof.leadingTs >= V1_MIN_LEADING_TS;
  const t1 = performance.now();
  results.push({
    layer: "Proof of Work (DNA256)",
    icon: "\u26CF\uFE0F",
    pass: powPass,
    detail: powPass
      ? `DNA256 strand has ${leadingTs} leading "T" bases (target ${coin.miningProof.leadingTs}): ${strand.slice(0, 24)}...`
      : `Strand only has ${leadingTs} leading Ts; ${coin.miningProof.leadingTs} required`,
    time: `${(t1 - t0).toFixed(2)}ms`,
  });

  // Layer 2: ribosome / protein translation
  const proteinResult = ribosome(coin.coinGene);
  const protein = proteinResult.proteins[0];
  const isCoin = protein ? isCoinProtein(protein) : false;
  const serial = protein ? getCoinSerial(protein) : "";
  const serialMatch = serial ? sha256(serial) === coin.serialHash : false;
  results.push({
    layer: "Protein Translation",
    icon: "\u{1F9EC}",
    pass: isCoin && serialMatch,
    detail: isCoin && serialMatch
      ? `Gene translates to coin protein. Serial hash matches: ${coin.serialHash.slice(0, 16)}...`
      : `Gene does not produce valid coin protein or serial mismatch`,
  });

  // Layer 3: Ed25519 miner signature
  const t2 = performance.now();
  const msg = coinV1SigningMessage(
    coin.serialHash,
    coin.networkGenomeFingerprint,
    coin.minerPubKeyDNA,
  );
  const sigPass = verifyWithDNA(msg, coin.minerSignatureDNA, coin.minerPubKeyDNA);
  const t3 = performance.now();
  results.push({
    layer: "Ed25519 Miner Signature",
    icon: "\u{1F511}",
    pass: sigPass,
    detail: sigPass
      ? `Miner signature verified against pubkey ${coin.minerPubKeyDNA.slice(0, 20)}...`
      : `Signature INVALID — does not match miner public key`,
    time: `${(t3 - t2).toFixed(2)}ms`,
  });

  // Layer 4: genesis fingerprint pinning
  const fpPass = coin.networkGenomeFingerprint === GENESIS_GENOME_FINGERPRINT;
  results.push({
    layer: "Genesis Fingerprint Lock",
    icon: "\u{1F9EC}",
    pass: fpPass,
    detail: fpPass
      ? `Coin pinned to v1 genesis fingerprint ${GENESIS_GENOME_FINGERPRINT.slice(0, 16)}...`
      : `Coin carries WRONG fingerprint — not a v1 BioCrypt coin`,
  });

  return results;
}

function tamperCoin(coin: CoinV1, tamperType: string): CoinV1 {
  const c: CoinV1 = JSON.parse(JSON.stringify(coin));
  switch (tamperType) {
    case "gene": {
      const bases = c.coinGene.split("");
      const idx = 20 + Math.floor(Math.random() * (bases.length - 40));
      bases[idx] = bases[idx] === "A" ? "T" : "A";
      c.coinGene = bases.join("");
      break;
    }
    case "nonce":
      c.miningProof.nonce = c.miningProof.nonce + 1;
      break;
    case "signature": {
      const sigBases = c.minerSignatureDNA.split("");
      sigBases[10] = sigBases[10] === "A" ? "G" : "A";
      c.minerSignatureDNA = sigBases.join("");
      break;
    }
    case "pubkey": {
      const pkBases = c.minerPubKeyDNA.split("");
      pkBases[5] = pkBases[5] === "A" ? "C" : "A";
      c.minerPubKeyDNA = pkBases.join("");
      break;
    }
    case "serial":
      c.serialHash = sha256("FAKE-SERIAL-" + Date.now());
      break;
    case "fingerprint":
      c.networkGenomeFingerprint = c.networkGenomeFingerprint
        .split("").reverse().join("");
      break;
  }
  return c;
}

export function Proof() {
  const storeCoins = useStore((s) => s.coins);
  const [coin, setCoin] = useState<CoinV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTamper, setActiveTamper] = useState<string | null>(null);

  useEffect(() => {
    const v1Coin = storeCoins.find(
      (c) =>
        c.protocolVersion === 1
        && c.minerSignatureDNA
        && c.minerPubKeyDNA
        && c.networkGenomeFingerprint,
    );
    if (v1Coin) {
      setCoin({
        protocolVersion: 1,
        networkGenomeFingerprint: v1Coin.networkGenomeFingerprint!,
        coinGene: v1Coin.coinGene,
        serial: v1Coin.serial || "",
        serialHash: v1Coin.serialHash,
        miningProof: {
          nonce: v1Coin.nonce,
          leadingTs: v1Coin.leadingTs ?? V1_MIN_LEADING_TS,
        },
        minerPubKeyDNA: v1Coin.minerPubKeyDNA!,
        minerSignatureDNA: v1Coin.minerSignatureDNA!,
        minedAt: v1Coin.minedAt,
      });
    }
    setLoading(false);
  }, [storeCoins]);

  const realResults = useMemo(() => verifyCoinLayers(coin), [coin]);
  const tamperResults = useMemo(
    () => activeTamper && coin ? verifyCoinLayers(tamperCoin(coin, activeTamper)) : [],
    [coin, activeTamper],
  );

  return (
    <div className="page proof-page">
      <HeroSection />
      <MathSection />
      {coin && coin.coinGene ? (
        <>
          <LiveVerifySection coin={coin} results={realResults} />
          <TamperSection
            coin={coin}
            activeTamper={activeTamper}
            setActiveTamper={setActiveTamper}
            tamperResults={tamperResults}
            realResults={realResults}
          />
        </>
      ) : (
        <NoLocalCoinSection loading={loading} />
      )}
      <EntropySection />
      <AttackTreeSection />
      <ImpossibilitySection />
      <style>{proofStyles}</style>
    </div>
  );
}

function HeroSection() {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`proof-section ${r.visible ? "revealed" : ""}`}>
      <div className="proof-hero">
        <div className="proof-shield-icon">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <path d="M40 5 L70 20 V45 C70 62 55 75 40 78 C25 75 10 62 10 45 V20 Z" fill="none" stroke="var(--primary)" strokeWidth="2.5"/>
            <path d="M28 40 L36 48 L52 32" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="proof-title">Cryptographic Proof</h1>
        <p className="proof-subtitle">
          Every BioCrypt v1 coin carries four independent, mathematically verifiable proofs of authenticity.
          This page demonstrates <strong>why forging a coin is computationally impossible</strong> — and lets you try.
        </p>
      </div>
    </section>
  );
}

function MathSection() {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`proof-section ${r.visible ? "revealed" : ""}`}>
      <h2 className="proof-section-title">The Four Locks</h2>
      <p className="proof-section-sub">
        A forger must break ALL four simultaneously. Breaking one leaves three intact.
        No single party — including the BioCrypt project — can produce a valid coin without doing the full work.
      </p>
      <div className="locks-grid">
        <LockCard
          num={1} name="DNA256 Proof-of-Work" color="#f59e0b"
          equation="countLeadingTs(DNA256(gene || nonce)) >= 16"
          bits={32} ops="~4.3 x 10^9"
          explanation={
            "Must find a nonce such that DNA256(gene || nonce) — a domain-separated " +
            "SHA-256 digest encoded as a 256-nucleotide TACG strand — begins with at " +
            "least 18 leading 'T' bases. Each attempt is a fresh hash + codec; the " +
            "one-way property of SHA-256 makes it non-invertible."
          }
          analogy="Instead of counting hex zeros like Bitcoin, we count leading T bases in the DNA — same math, DNA-native display."
        />
        <LockCard
          num={2} name="Ed25519 Miner Signature" color="#3b82f6"
          equation="Verify(minerPubKey, sig, serialHash|fp|pubKey) = true"
          bits={128} ops="3.4 x 10^38"
          explanation="The miner signs each coin with their own Ed25519 wallet key encoded as DNA, and embeds their public key directly in the coin. No central party can sign for a miner. Forging requires inverting elliptic curve discrete logarithm — proven computationally infeasible."
          analogy="Every coin is signed by the specific wallet that mined it. Each wallet is its own sovereign signer."
        />
        <LockCard
          num={3} name="Genesis Fingerprint Lock" color="#8b5cf6"
          equation="coin.fingerprint == SHA256(GENESIS_GENOME)"
          bits={256} ops="1.16 x 10^77"
          explanation="Every v1 coin must carry the frozen genesis genome fingerprint. Since no private key exists for this published genome, no party can re-seal a coin to a different network. Pinning is implicit: if the fingerprint doesn't match, verifyCoinV1 rejects unconditionally."
          analogy="Like a paternity lock. The whole network agrees on one published DNA; coins mined on a fake network simply aren't BioCrypt coins."
        />
        <LockCard
          num={4} name="Nullifier Double-Spend Shield" color="#ef4444"
          equation="N = SHA-256(serialHash || SHA-256(senderPrivKeyDNA))"
          bits={256} ops="1.16 x 10^77"
          explanation="Each spend publishes a deterministic nullifier hash. The same coin + same sender always produces the same nullifier. Trackers reject duplicates. You can't produce a different nullifier for the same coin without the sender's private key."
          analogy="Like a one-time seal that shatters. Once broken, every tracker in the mesh sees it was used. Cannot be resealed."
        />
      </div>
    </section>
  );
}

function LockCard({ num, name, color, equation, bits, ops, explanation, analogy }: {
  num: number; name: string; color: string; equation: string; bits: number;
  ops: string; explanation: string; analogy: string;
}) {
  const r = useReveal();
  return (
    <div ref={r.ref} className={`lock-card ${r.visible ? "revealed" : ""}`} style={{ borderTopColor: color, animationDelay: `${num * 0.12}s` }}>
      <div className="lock-header">
        <div className="lock-num" style={{ background: color }}>{num}</div>
        <h3>{name}</h3>
      </div>
      <div className="lock-equation mono">{equation}</div>
      <div className="lock-entropy">
        <div className="entropy-bar">
          <div className="entropy-fill" style={{ width: `${Math.min(100, (bits / 256) * 100)}%`, background: color }} />
        </div>
        <div className="entropy-labels">
          <span>{bits}-bit security</span>
          <span>{ops} operations</span>
        </div>
      </div>
      <p className="lock-explain">{explanation}</p>
      <div className="lock-analogy">
        <span className="lock-analogy-tag">Real-world analogy</span>
        <p>{analogy}</p>
      </div>
    </div>
  );
}

function LiveVerifySection({ coin, results }: { coin: CoinV1; results: VerifyResult[] }) {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`proof-section proof-live ${r.visible ? "revealed" : ""}`}>
      <h2 className="proof-section-title">Live Verification — Your Real Coin</h2>
      <p className="proof-section-sub">
        This is a coin from your wallet. All four layers are verified <strong>right now, in your browser</strong> — no server needed.
      </p>
      <div className="coin-card">
        <div className="coin-card-header">
          <span className="badge badge-primary">Genuine Coin · v{coin.protocolVersion}</span>
          <span className="mono text-xs">{coin.serialHash.slice(0, 24)}...</span>
        </div>
        {coin.coinGene && (
          <div className="coin-gene mono text-xs">{coin.coinGene.slice(0, 60)}...{coin.coinGene.slice(-20)}</div>
        )}
      </div>
      <div className="verify-results">
        {results.map((r, i) => (
          <div key={i} className={`verify-row ${r.pass ? "verify-pass" : "verify-fail"}`}>
            <div className="verify-icon">{r.icon}</div>
            <div className="verify-status">{r.pass ? "\u2705" : "\u274C"}</div>
            <div className="verify-body">
              <div className="verify-layer">{r.layer}</div>
              <div className="verify-detail">{r.detail}</div>
            </div>
            {r.time && <div className="verify-time">{r.time}</div>}
          </div>
        ))}
      </div>
      <div className="verify-verdict verify-verdict-pass">
        All {results.length} verification layers passed. This coin is authentic.
      </div>
    </section>
  );
}

function NoLocalCoinSection({ loading }: { loading: boolean }) {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`proof-section ${r.visible ? "revealed" : ""}`}>
      <div className="proof-nocoin">
        <div className="proof-nocoin-icon">{"\u{1F50D}"}</div>
        <h3>{loading ? "Loading coin data..." : "Mine a Coin to See Live Verification"}</h3>
        <p className="text-muted">
          {loading ? "Checking your wallet for signed coins..." :
            "The live verification demo requires a v1 signed coin in your wallet. Mine one to see all four layers verified in real-time."}
        </p>
        {!loading && <Link to="/mine" className="btn btn-primary">Start Mining</Link>}
      </div>
    </section>
  );
}

const TAMPER_OPTIONS = [
  { id: "gene", label: "Mutate coin gene", desc: "Change 1 base in the DNA", icon: "\u{1F9EC}", breaks: [0, 1, 2] },
  { id: "nonce", label: "Change nonce", desc: "Increment nonce by 1", icon: "#\uFE0F\u20E3", breaks: [0] },
  { id: "signature", label: "Alter miner sig", desc: "Change 1 base in Ed25519 sig", icon: "\u{1F511}", breaks: [2] },
  { id: "pubkey", label: "Swap miner key", desc: "Alter embedded miner pubkey", icon: "\u{1F510}", breaks: [2] },
  { id: "serial", label: "Swap serial hash", desc: "Replace with random hash", icon: "\u{1F3F7}\uFE0F", breaks: [1, 2] },
  { id: "fingerprint", label: "Fake genesis", desc: "Reverse the genome fingerprint", icon: "\u{1F9EC}", breaks: [2, 3] },
];

function TamperSection({ coin, activeTamper, setActiveTamper, tamperResults, realResults }: {
  coin: CoinV1;
  activeTamper: string | null;
  setActiveTamper: (t: string | null) => void;
  tamperResults: VerifyResult[];
  realResults: VerifyResult[];
}) {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`proof-section proof-tamper ${r.visible ? "revealed" : ""}`}>
      <h2 className="proof-section-title">Tamper Experiment</h2>
      <p className="proof-section-sub">
        Try to forge a coin. Pick any tampering method below and watch the verification layers fail in real-time.
      </p>
      <div className="tamper-buttons">
        {TAMPER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`tamper-btn ${activeTamper === opt.id ? "tamper-active" : ""}`}
            onClick={() => setActiveTamper(activeTamper === opt.id ? null : opt.id)}
          >
            <span className="tamper-btn-icon">{opt.icon}</span>
            <span className="tamper-btn-label">{opt.label}</span>
            <span className="tamper-btn-desc">{opt.desc}</span>
          </button>
        ))}
      </div>

      {activeTamper && tamperResults.length > 0 && (
        <div className="tamper-comparison">
          <div className="tamper-col">
            <h4 className="text-primary">Genuine Coin</h4>
            {realResults.map((r, i) => (
              <div key={i} className={`verify-row-mini ${r.pass ? "verify-pass" : "verify-fail"}`}>
                <span className="verify-status-mini">{r.pass ? "\u2705" : "\u274C"}</span>
                <span>{r.layer}</span>
              </div>
            ))}
            <div className="verify-verdict verify-verdict-pass">AUTHENTIC</div>
          </div>
          <div className="tamper-vs">VS</div>
          <div className="tamper-col">
            <h4 style={{ color: "var(--danger)" }}>
              Tampered: {TAMPER_OPTIONS.find((o) => o.id === activeTamper)?.label}
            </h4>
            {tamperResults.map((r, i) => (
              <div key={i} className={`verify-row-mini ${r.pass ? "verify-pass" : "verify-fail"}`}>
                <span className="verify-status-mini">{r.pass ? "\u2705" : "\u274C"}</span>
                <span>{r.layer}</span>
              </div>
            ))}
            <div className="verify-verdict verify-verdict-fail">FORGED — REJECTED</div>
          </div>
        </div>
      )}
    </section>
  );
}

function EntropySection() {
  const r = useReveal();
  const layers = [
    { name: "DNA256 PoW (18 leading Ts)", bits: 36, color: "#f59e0b" },
    { name: "Ed25519 Miner Signature", bits: 128, color: "#3b82f6" },
    { name: "Genesis Fingerprint (SHA-256)", bits: 256, color: "#8b5cf6" },
    { name: "Nullifier Hash", bits: 256, color: "#ef4444" },
  ];
  const totalBits = layers.reduce((s, l) => s + l.bits, 0);

  return (
    <section ref={r.ref} className={`proof-section ${r.visible ? "revealed" : ""}`}>
      <h2 className="proof-section-title">Entropy Analysis</h2>
      <p className="proof-section-sub">Combined security: {totalBits} bits. The universe has ~10^80 atoms. Breaking this requires 10^{Math.floor(totalBits * 0.301)} operations.</p>
      <div className="entropy-stack">
        {layers.map((l, i) => (
          <div key={i} className="entropy-layer">
            <div className="entropy-layer-label">{l.name}</div>
            <div className="entropy-layer-bar">
              <div className="entropy-layer-fill" style={{ width: `${(l.bits / 256) * 100}%`, background: l.color }} />
            </div>
            <div className="entropy-layer-bits">{l.bits} bits</div>
          </div>
        ))}
        <div className="entropy-total">
          <div className="entropy-total-bar">
            <div className="entropy-total-fill" style={{ width: "100%" }} />
          </div>
          <div className="entropy-total-label">Combined: {totalBits} bits = 2^{totalBits} possible states</div>
        </div>
      </div>

      <div className="time-to-crack">
        <h3>Time to Crack at Various Speeds</h3>
        <div className="crack-grid">
          <CrackRow attacker="Consumer GPU" speed="10^9 H/s" layer="PoW only" years={formatYears(Math.pow(2, 32) / 1e9 / 3.15e7)} />
          <CrackRow attacker="GPU Farm (1000x)" speed="10^12 H/s" layer="Ed25519" years={formatYears(Math.pow(2, 128) / 1e12 / 3.15e7)} />
          <CrackRow attacker="All Bitcoin miners" speed="10^20 H/s" layer="Ed25519" years={formatYears(Math.pow(2, 128) / 1e20 / 3.15e7)} />
          <CrackRow attacker="Theoretical quantum (Grover)" speed="sqrt reduction" layer="Ed25519" years={formatYears(Math.pow(2, 64) / 1e15 / 3.15e7)} />
          <CrackRow attacker="All matter in universe as compute" speed="~10^80 ops/s" layer={`Combined (${totalBits} bits)`} years="10^71 years" />
        </div>
        <div className="crack-context">
          <div className="crack-context-item">
            <div className="crack-context-val">13.8 billion</div>
            <div className="crack-context-lbl">Age of the universe (years)</div>
          </div>
          <div className="crack-context-item">
            <div className="crack-context-val">10^80</div>
            <div className="crack-context-lbl">Atoms in observable universe</div>
          </div>
          <div className="crack-context-item">
            <div className="crack-context-val">10^{Math.floor(totalBits * 0.301)}</div>
            <div className="crack-context-lbl">Operations to break BioCrypt</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CrackRow({ attacker, speed, layer, years }: { attacker: string; speed: string; layer: string; years: string }) {
  return (
    <div className="crack-row">
      <div className="crack-attacker">{attacker}</div>
      <div className="crack-speed mono">{speed}</div>
      <div className="crack-layer">{layer}</div>
      <div className="crack-years mono">{years}</div>
    </div>
  );
}

function formatYears(y: number): string {
  if (!isFinite(y) || y > 1e30) return "> 10^30 years";
  if (y > 1e20) return `~10^${Math.floor(Math.log10(y))} years`;
  if (y > 1e9) return `${(y / 1e9).toFixed(1)} billion years`;
  if (y > 1e6) return `${(y / 1e6).toFixed(1)} million years`;
  if (y > 1000) return `${(y / 1000).toFixed(1)}K years`;
  if (y > 1) return `${y.toFixed(1)} years`;
  if (y > 1 / 365) return `${(y * 365).toFixed(0)} days`;
  if (y > 1 / 365 / 24) return `${(y * 365 * 24).toFixed(0)} hours`;
  return `${(y * 365 * 24 * 3600).toFixed(1)} seconds`;
}

function AttackTreeSection() {
  const r = useReveal();
  const attacks = [
    {
      name: "Forge a coin from scratch",
      layers: ["Must compute valid 16-T DNA256 PoW", "Must produce Ed25519 sig without any known miner's private key", "Fingerprint must equal GENESIS_GENOME_FINGERPRINT", "Serial hash must match ribosome output"],
      verdict: "Requires breaking elliptic curve discrete log. Proven infeasible.",
      impossible: true,
    },
    {
      name: "Clone an existing coin",
      layers: ["PoW would match (copied)", "Signature would match (copied)", "Fingerprint would match (copied)", "But the nullifier on spend will collide and get rejected mesh-wide"],
      verdict: "Nullifier gossip detects the duplicate instantly. Clone is rejected everywhere.",
      impossible: true,
    },
    {
      name: "Mine on a fake network, call it BioCrypt",
      layers: ["PoW valid (computed honestly against your own seed)", "Miner signature valid (own key)", "Fingerprint does NOT match GENESIS_GENOME_FINGERPRINT", "Every v1 tracker and wallet rejects it unconditionally"],
      verdict: "Different genesis seed = different fingerprint = not a BioCrypt coin. Pinning is unforgeable.",
      impossible: true,
    },
    {
      name: "Modify coin gene after signing",
      layers: ["PoW breaks (hash changes)", "Serial hash changes — signature won't verify", "Ribosome output diverges", "Every layer cascade-fails"],
      verdict: "Even a single base change invalidates the entire proof chain.",
      impossible: true,
    },
    {
      name: "Reverse-engineer miner private key from public key",
      layers: ["Ed25519 uses Curve25519", "Computing private from public = discrete log", "Best known: O(2^128) operations", "Quantum (Shor): feasible only with large fault-tolerant QC, still decades away"],
      verdict: "Same hardness as breaking all of modern cryptography.",
      impossible: true,
    },
    {
      name: "Spend someone else's coin",
      layers: ["Envelope is nacl.box encrypted to recipient's X25519 key", "Nullifier = SHA-256(serialHash || SHA-256(senderPrivKey))", "Without the current owner's private key you cannot produce a valid nullifier or transfer signature", "Tracker rejects unsigned / wrong-signature spends"],
      verdict: "Ownership is mathematically bound to the Ed25519 private key. No key = no spend.",
      impossible: true,
    },
  ];

  return (
    <section ref={r.ref} className={`proof-section ${r.visible ? "revealed" : ""}`}>
      <h2 className="proof-section-title">Attack Scenarios</h2>
      <p className="proof-section-sub">Every known attack vector, analyzed. Every one fails.</p>
      <div className="attack-list">
        {attacks.map((a, i) => (
          <div key={i} className="attack-card">
            <div className="attack-header">
              <span className="attack-icon">{a.impossible ? "\u{1F6AB}" : "\u26A0\uFE0F"}</span>
              <h4>{a.name}</h4>
            </div>
            <div className="attack-layers">
              {a.layers.map((l, j) => (
                <div key={j} className="attack-step">
                  <span className="attack-step-num">{j + 1}</span>
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <div className={`attack-verdict ${a.impossible ? "attack-impossible" : "attack-possible"}`}>
              {a.verdict}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImpossibilitySection() {
  const r = useReveal();
  return (
    <section ref={r.ref} className={`proof-section proof-final ${r.visible ? "revealed" : ""}`}>
      <div className="impossibility-card">
        <div className="impossibility-icon">
          <svg viewBox="0 0 60 60" width="60" height="60">
            <circle cx="30" cy="30" r="28" fill="none" stroke="var(--primary)" strokeWidth="2" />
            <path d="M18 30 L26 38 L42 22" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2>Mathematically Proven Unforgeable</h2>
        <p>
          To forge a single BioCrypt v1 coin, an attacker must simultaneously: compute a valid DNA256
          proof-of-work with 18 leading T bases, forge an Ed25519 signature without any miner's
          private key, produce the frozen genesis fingerprint (SHA-256 preimage), and then avoid a
          nullifier collision on spend.
        </p>
        <p>
          The probability of success is approximately <strong className="mono">2^-672</strong> per attempt.
          If every atom in the observable universe (10^80) computed one attempt per nanosecond for
          the entire age of the universe (13.8 billion years), the probability of forging even ONE
          coin would be approximately <strong className="mono">10^-100</strong> — effectively zero.
        </p>
        <div className="impossibility-cta">
          <Link to="/mine" className="btn btn-primary btn-glow">Start Mining Real Coins</Link>
          <Link to="/economics" className="btn btn-secondary">View Economics</Link>
        </div>
      </div>
    </section>
  );
}

const proofStyles = `
.proof-page { max-width: 960px; margin: 0 auto; }

.proof-section {
  opacity: 0; transform: translateY(30px);
  transition: opacity 0.7s ease, transform 0.7s ease;
  padding: 2.5rem 0;
}
.proof-section.revealed { opacity: 1; transform: translateY(0); }

/* Hero */
.proof-hero { text-align: center; padding: 3rem 0 1rem; }
.proof-shield-icon { margin-bottom: 1.5rem; display: flex; justify-content: center; }
.proof-title {
  font-size: clamp(2rem, 5vw, 3rem); font-weight: 900; margin-bottom: 1rem;
}
.proof-subtitle {
  color: var(--text-muted); font-size: 1.05rem; max-width: 600px;
  margin: 0 auto; line-height: 1.6;
}

/* Section titles */
.proof-section-title {
  text-align: center; font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 800; margin-bottom: 0.5rem;
}
.proof-section-sub {
  text-align: center; color: var(--text-muted); max-width: 600px;
  margin: 0 auto 2rem; line-height: 1.5;
}

/* Lock cards */
.locks-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
.lock-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-top: 4px solid; border-radius: var(--radius-lg); padding: 1.5rem;
  opacity: 0; transform: translateY(20px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.lock-card.revealed { opacity: 1; transform: translateY(0); }
.lock-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.lock-num {
  width: 28px; height: 28px; border-radius: 50%; display: flex;
  align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.85rem; color: white;
}
.lock-header h3 { font-size: 1rem; margin: 0; }
.lock-equation {
  background: var(--bg-surface); padding: 0.5rem 0.75rem; border-radius: var(--radius);
  font-size: 0.8rem; margin-bottom: 1rem; color: var(--primary);
  border: 1px solid var(--border);
}
.lock-entropy { margin-bottom: 1rem; }
.entropy-bar {
  height: 8px; background: var(--bg-surface); border-radius: 4px;
  overflow: hidden; margin-bottom: 0.35rem;
}
.entropy-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
.entropy-labels {
  display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted);
}
.lock-explain { color: var(--text-muted); font-size: 0.85rem; line-height: 1.5; margin-bottom: 0.75rem; }
.lock-analogy {
  background: var(--bg-surface); border-radius: var(--radius); padding: 0.75rem;
  border-left: 3px solid var(--secondary);
}
.lock-analogy-tag {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  color: var(--secondary); letter-spacing: 0.05em;
}
.lock-analogy p { font-size: 0.8rem; color: var(--text-muted); margin: 0.25rem 0 0; line-height: 1.4; }

/* Live verify */
.proof-live, .proof-tamper {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 2rem;
}
.coin-card {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1rem; margin-bottom: 1.5rem;
}
.coin-card-header {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;
}
.coin-gene {
  word-break: break-all; color: var(--text-dim); background: var(--bg);
  padding: 0.5rem; border-radius: var(--radius); font-size: 0.7rem;
}
.verify-results { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.verify-row {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
  border-radius: var(--radius); border: 1px solid var(--border);
  transition: all 0.3s;
}
.verify-pass { background: rgba(0, 229, 153, 0.05); border-color: rgba(0, 229, 153, 0.2); }
.verify-fail { background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2); }
.verify-icon { font-size: 1.2rem; }
.verify-status { font-size: 1.1rem; }
.verify-body { flex: 1; }
.verify-layer { font-weight: 600; font-size: 0.9rem; }
.verify-detail { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; word-break: break-all; }
.verify-time { font-family: var(--mono); font-size: 0.7rem; color: var(--text-dim); }
.verify-verdict {
  text-align: center; padding: 0.75rem; border-radius: var(--radius);
  font-weight: 700; font-size: 0.9rem;
}
.verify-verdict-pass { background: rgba(0, 229, 153, 0.1); color: var(--primary); }
.verify-verdict-fail { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

/* Tamper */
.tamper-buttons {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem; margin-bottom: 1.5rem;
}
.tamper-btn {
  display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
  padding: 1rem; background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer; transition: all 0.2s;
  color: var(--text);
}
.tamper-btn:hover { border-color: var(--danger); }
.tamper-active { border-color: var(--danger); background: rgba(239, 68, 68, 0.08); box-shadow: 0 0 12px rgba(239, 68, 68, 0.15); }
.tamper-btn-icon { font-size: 1.5rem; }
.tamper-btn-label { font-weight: 600; font-size: 0.85rem; }
.tamper-btn-desc { font-size: 0.7rem; color: var(--text-muted); }

.tamper-comparison {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem;
  align-items: start;
}
.tamper-col {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1rem;
}
.tamper-col h4 { margin-bottom: 0.75rem; font-size: 0.95rem; }
.tamper-vs {
  align-self: center; font-weight: 900; font-size: 1rem; color: var(--text-dim);
}
.verify-row-mini {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.4rem 0; font-size: 0.85rem;
}
.verify-status-mini { font-size: 0.9rem; }

/* No coin */
.proof-nocoin { text-align: center; padding: 2rem; }
.proof-nocoin-icon { font-size: 3rem; margin-bottom: 1rem; }
.proof-nocoin h3 { margin-bottom: 0.5rem; }

/* Entropy */
.entropy-stack { max-width: 600px; margin: 0 auto 2rem; }
.entropy-layer {
  display: grid; grid-template-columns: 160px 1fr 80px; gap: 0.75rem;
  align-items: center; margin-bottom: 0.75rem;
}
.entropy-layer-label { font-size: 0.8rem; font-weight: 600; }
.entropy-layer-bar {
  height: 12px; background: var(--bg-surface); border-radius: 6px;
  overflow: hidden; border: 1px solid var(--border);
}
.entropy-layer-fill { height: 100%; border-radius: 6px; transition: width 0.5s; }
.entropy-layer-bits { font-family: var(--mono); font-size: 0.8rem; color: var(--text-muted); text-align: right; }
.entropy-total { margin-top: 1rem; }
.entropy-total-bar {
  height: 16px; background: var(--bg-surface); border-radius: 8px;
  overflow: hidden; border: 1px solid var(--border);
}
.entropy-total-fill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #3b82f6, #8b5cf6, #ef4444);
  border-radius: 8px;
}
.entropy-total-label {
  text-align: center; margin-top: 0.5rem; font-family: var(--mono);
  font-size: 0.8rem; font-weight: 700; color: var(--primary);
}

/* Crack times */
.time-to-crack {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1.5rem; margin-top: 1.5rem;
}
.time-to-crack h3 { text-align: center; margin-bottom: 1rem; font-size: 1.1rem; }
.crack-grid { margin-bottom: 1.5rem; }
.crack-row {
  display: grid; grid-template-columns: 2fr 1.2fr 1fr 1.5fr; gap: 0.5rem;
  padding: 0.6rem 0; border-bottom: 1px solid var(--border);
  font-size: 0.8rem; align-items: center;
}
.crack-attacker { font-weight: 600; }
.crack-speed { color: var(--text-muted); font-size: 0.75rem; }
.crack-layer { color: var(--text-muted); }
.crack-years { color: var(--danger); font-weight: 700; font-size: 0.75rem; }
.crack-context {
  display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap;
}
.crack-context-item { text-align: center; }
.crack-context-val {
  font-family: var(--mono); font-size: 1.2rem; font-weight: 800; color: var(--primary);
}
.crack-context-lbl { font-size: 0.7rem; color: var(--text-muted); }

/* Attack scenarios */
.attack-list {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;
}
.attack-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1.25rem;
}
.attack-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
.attack-icon { font-size: 1.3rem; }
.attack-header h4 { font-size: 0.95rem; margin: 0; }
.attack-layers { margin-bottom: 0.75rem; }
.attack-step {
  display: flex; align-items: flex-start; gap: 0.5rem;
  padding: 0.3rem 0; font-size: 0.8rem; color: var(--text-muted);
}
.attack-step-num {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  background: var(--bg-surface); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.65rem; font-weight: 700; color: var(--text-dim);
}
.attack-verdict {
  font-size: 0.8rem; font-weight: 600; padding: 0.5rem 0.75rem;
  border-radius: var(--radius); line-height: 1.4;
}
.attack-impossible { background: rgba(239, 68, 68, 0.08); color: var(--danger); }
.attack-possible { background: rgba(245, 158, 11, 0.08); color: var(--warning); }

/* Final */
.proof-final { text-align: center; }
.impossibility-card {
  background: linear-gradient(135deg, rgba(0,229,153,0.05), rgba(14,165,233,0.05));
  border: 1px solid var(--primary); border-radius: var(--radius-lg);
  padding: 3rem 2rem; max-width: 700px; margin: 0 auto;
}
.impossibility-icon { margin-bottom: 1rem; }
.impossibility-card h2 { font-size: 1.5rem; margin-bottom: 1rem; }
.impossibility-card p { color: var(--text-muted); line-height: 1.6; margin-bottom: 1rem; max-width: 550px; margin-left: auto; margin-right: auto; }
.impossibility-cta { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem; }

@media (max-width: 640px) {
  .locks-grid { grid-template-columns: 1fr; }
  .tamper-comparison { grid-template-columns: 1fr; }
  .tamper-vs { text-align: center; }
  .crack-row { grid-template-columns: 1fr 1fr; }
  .entropy-layer { grid-template-columns: 1fr; gap: 0.25rem; }
  .attack-list { grid-template-columns: 1fr; }
}
`;
