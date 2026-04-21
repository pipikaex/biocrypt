import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const TRACKER_WS = "wss://tracker.biocrypt.net";
const TRACKER_HTTP = "https://tracker.biocrypt.net";

interface GenomeInfo {
  genomeFingerprint: string;
  networkGenome?: string;
  leadingTs: number;
  protocolVersion: number;
  networkId?: string;
}

interface TrackerSummary {
  trackerId: string;
  totalMinted: number;
  totalSpent: number;
  last24h?: number;
  pendingEnvelopes?: number;
  peers?: number;
}

export function Download() {
  const [genome, setGenome] = useState<GenomeInfo | null>(null);
  const [summary, setSummary] = useState<TrackerSummary | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [g, s] = await Promise.all([
          fetch(`${TRACKER_HTTP}/genome`).then((r) => r.json()),
          fetch(`${TRACKER_HTTP}/summary`).then((r) => r.json()),
        ]);
        if (!alive) return;
        setGenome(g);
        setSummary(s);
        setLoadError("");
      } catch (e: any) {
        if (!alive) return;
        setLoadError(e?.message || "tracker unreachable");
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const leadingTs = genome?.leadingTs ?? 16;
  const fpShort = genome?.genomeFingerprint
    ? `${genome.genomeFingerprint.slice(0, 12)}...`
    : "...";

  return (
    <div className="page" style={{ maxWidth: "900px" }}>
      <header style={{ marginBottom: "2.5rem" }}>
        <div className="mono" style={{ color: "var(--text-muted)", fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
          BioCrypt v1 &mdash; decentralized mining
        </div>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginBottom: "1rem" }}>
          Download &amp; Run a Miner
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.05rem", maxWidth: "46rem" }}>
          BioCrypt is decentralized. Anyone can mine. The native miner is a tiny
          binary; the Node wrapper signs each solution with <em>your</em> Ed25519
          wallet and streams it over WebSocket to a public tracker. No accounts,
          no registration, no network-held private keys.
        </p>
      </header>

      <section className="card card-accent" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Live network</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1.25rem", marginTop: "1rem" }}>
          <Stat label="Protocol" value={genome ? `v${genome.protocolVersion}` : "..."} />
          <Stat label="PoW target" value={`${leadingTs} leading T`} />
          <Stat label="Total minted" value={summary ? String(summary.totalMinted) : "..."} />
          <Stat label="Total spent" value={summary ? String(summary.totalSpent) : "..."} />
          {typeof summary?.peers === "number" && (
            <Stat label="Peer trackers" value={String(summary.peers)} />
          )}
        </div>
        {loadError && (
          <div className="mono" style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--warning)" }}>
            Tracker unreachable: {loadError}
          </div>
        )}
        {genome?.genomeFingerprint && (
          <div className="mono" style={{ marginTop: "1rem", fontSize: "0.78rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
            genome fingerprint: {genome.genomeFingerprint}
            {genome.networkId && (
              <>
                <br />
                network id: {genome.networkId}
              </>
            )}
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>1. Grab the binary <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--text-muted)" }}>(macOS)</span></h2>
        <p style={{ color: "var(--text-muted)" }}>
          Universal Mach-O &mdash; runs on Apple Silicon and Intel. Pure PoW hot loop;
          no network code.
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
          <a className="btn btn-primary" href="/downloads/zcoin-miner-v1" download>
            Download zcoin-miner-v1 (universal)
          </a>
          <a className="btn btn-secondary" href="/downloads/zcoin-miner-v1-arm64" download>
            arm64
          </a>
          <a className="btn btn-secondary" href="/downloads/zcoin-miner-v1-x86_64" download>
            x86_64
          </a>
          <a className="btn btn-secondary" href="/downloads/zcoin-miner-v1.c" download>
            source (.c)
          </a>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "1.25rem" }}>
          Prefer to build from source:
        </p>
        <pre className="mono" style={codeStyle}>
{`curl -O https://www.biocrypt.net/downloads/zcoin-miner-v1.c
clang -O3 -o zcoin-miner-v1 zcoin-miner-v1.c
chmod +x zcoin-miner-v1`}
        </pre>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>2. Install the Node wrapper</h2>
        <p style={{ color: "var(--text-muted)" }}>
          The wrapper creates a miner wallet on first run, signs every PoW hit
          with your Ed25519 key, and streams mints over WebSocket. Node.js 20+.
        </p>
        <pre className="mono" style={codeStyle}>
{`# From npm (includes the tracker server too):
npm install --global @biocrypt/tracker

# Or grab the single-file script directly:
curl -O https://www.biocrypt.net/downloads/biocrypt-mine.mjs`}
        </pre>
      </section>

      <section className="card card-glow" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>3. Mine</h2>
        <pre className="mono" style={codeStyle}>
{`# Put zcoin-miner-v1 on your PATH, then:
biocrypt-mine --tracker ${TRACKER_WS}

# Or run the wrapper script directly:
node biocrypt-mine.mjs --tracker ${TRACKER_WS}

# A chime plays every time the tracker accepts a coin.
# Disable with --no-sound, or play on PoW found instead:
biocrypt-mine --sound-on candidate
biocrypt-mine --no-sound

# First run creates your wallet at ~/.biocrypt/miner-wallet.json
# This file IS your mining identity. Back it up.`}
        </pre>
        <p style={{ color: "var(--text-muted)", marginTop: "1.25rem", fontSize: "0.85rem" }}>
          Expected output:
        </p>
        <pre className="mono" style={{ ...codeStyle, opacity: 0.72 }}>
{`[ws] connected to ${TRACKER_WS}
[ws] welcome  genome=${fpShort}  lts=${leadingTs}
[stat]  88 MH/s   0 accepted / 0 rejected   uptime 12s
-> submitted  seq=1  serial=...  lts=${leadingTs}
*  accepted  serial=...  mintSeq=1  total=1`}
        </pre>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>4. Run your own tracker (optional)</h2>
        <p style={{ color: "var(--text-muted)" }}>
          Trackers are peer-to-peer: they gossip mints and spends to each
          other. Running your own means you carry a full copy of network state
          and help decentralise it.
        </p>
        <pre className="mono" style={codeStyle}>
{`npx @biocrypt/tracker --port 6690 --peer ${TRACKER_WS}

# Exposes:
#   ws://localhost:6690/           (tracker protocol)
#   http://localhost:6690/healthz
#   http://localhost:6690/genome
#   http://localhost:6690/summary
#   http://localhost:6690/latest`}
        </pre>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Protocol spec</h2>
        <p style={{ color: "var(--text-muted)" }}>
          The v1 spec is frozen and published. Any implementation that produces
          byte-identical coins can participate.
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <a className="btn btn-secondary" href="/downloads/PROTOCOL.md" target="_blank" rel="noreferrer">
            PROTOCOL.md
          </a>
          <a className="btn btn-secondary" href={`${TRACKER_HTTP}/genome`} target="_blank" rel="noreferrer">
            /genome (live)
          </a>
          <a className="btn btn-secondary" href={`${TRACKER_HTTP}/summary`} target="_blank" rel="noreferrer">
            /summary (live)
          </a>
          <Link className="btn btn-secondary" to="/how-it-works">
            How it works
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Windows &amp; Linux</h2>
        <p style={{ color: "var(--text-muted)" }}>
          The reference C miner uses Apple&apos;s <code>CommonCrypto</code>. To port:
          swap <code>CC_SHA256</code> for OpenSSL <code>SHA256</code> and
          compile with <code>-lcrypto</code>. PRs welcome &mdash; the source is
          &lt;300 lines. For a zero-install option, the browser miner on the{" "}
          <Link to="/mine">Mine</Link> page runs the same protocol in pure
          TypeScript.
        </p>
      </section>
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.9rem 1rem",
  fontSize: "0.8rem",
  overflowX: "auto",
  lineHeight: 1.55,
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: "1.2rem", fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
