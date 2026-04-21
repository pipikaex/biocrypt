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

      <section className="card card-glow" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>1. One-line install <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--text-muted)" }}>(recommended)</span></h2>
        <p style={{ color: "var(--text-muted)" }}>
          The <code>@biocrypt/tracker</code> npm package ships both the miner wrapper
          and the native C source. On first run it auto-compiles the PoW binary with
          your system <code>clang</code>/<code>cc</code>/<code>gcc</code> and drops it
          at <code>~/.biocrypt/zcoin-miner-v1</code>. Node.js 20+ and a C compiler
          (Xcode CLT on macOS, <code>build-essential</code> on Linux) are the only
          prerequisites.
        </p>
        <pre className="mono" style={codeStyle}>
{`npm install --global @biocrypt/tracker
biocrypt-mine --tracker ${TRACKER_WS}`}
        </pre>
        <p style={{ color: "var(--text-muted)", marginTop: "1.25rem", fontSize: "0.85rem" }}>
          First run creates <code>~/.biocrypt/miner-wallet.json</code> &mdash; this
          file <strong>is</strong> your mining identity. Back it up.
        </p>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>2. Manual build <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></h2>
        <p style={{ color: "var(--text-muted)" }}>
          Prefer to inspect or pre-build the miner? It&apos;s &lt;300 lines of C with
          zero deps beyond <code>CommonCrypto</code>/<code>OpenSSL</code>. The wrapper
          auto-discovers the binary in <code>./</code>, <code>~/.biocrypt/</code>,
          <code>~/.local/bin/</code>, <code>/opt/homebrew/bin/</code>,
          <code>/usr/local/bin/</code>, and <code>/usr/bin/</code>.
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <a className="btn btn-secondary" href="/downloads/zcoin-miner-v1.c" download>
            source (.c)
          </a>
          <a className="btn btn-secondary" href="/downloads/zcoin-miner-v1-arm64" download>
            prebuilt arm64
          </a>
          <a className="btn btn-secondary" href="/downloads/zcoin-miner-v1-x86_64" download>
            prebuilt x86_64
          </a>
          <a className="btn btn-secondary" href="/downloads/zcoin-miner-v1" download>
            universal macOS
          </a>
        </div>
        <pre className="mono" style={{ ...codeStyle, marginTop: "1.25rem" }}>
{`# Build from source
curl -O https://www.biocrypt.net/downloads/zcoin-miner-v1.c
clang -O3 -o zcoin-miner-v1 zcoin-miner-v1.c     # macOS / Linux
chmod +x zcoin-miner-v1

# Install to PATH
sudo mv zcoin-miner-v1 /opt/homebrew/bin/        # Apple Silicon
sudo mv zcoin-miner-v1 /usr/local/bin/           # Intel mac / Linux`}
        </pre>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>3. Mine</h2>
        <pre className="mono" style={codeStyle}>
{`biocrypt-mine --tracker ${TRACKER_WS}

# Or run the single-file wrapper directly:
curl -O https://www.biocrypt.net/downloads/biocrypt-mine.mjs
node biocrypt-mine.mjs --tracker ${TRACKER_WS}

# Sound effect options (chime on mined coin):
biocrypt-mine --sound-on candidate    # play on PoW hit (default)
biocrypt-mine --sound-on accept       # play on tracker ack
biocrypt-mine --no-sound              # silent

# Custom wallet / threads / difficulty:
biocrypt-mine --wallet ~/keys/my-miner.json --threads 8 --leading-ts 16`}
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
