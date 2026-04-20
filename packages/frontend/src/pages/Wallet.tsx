import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { createWallet, viewWallet, ribosome, integrateCoinGene, isCoinProtein, type Protein } from "@biocrypt/core";
import { useStore, type LocalWallet, type MinedCoin } from "../store";
import { DNAVisualization } from "../components/DNAVisualization";
import { ProteinBar } from "../ProteinBar";
import { api } from "../api";

export function Wallet() {
  const wallet = useStore((s) => s.wallet);
  const coins = useStore((s) => s.coins);
  const setWallet = useStore((s) => s.setWallet);
  const addToast = useStore((s) => s.addToast);
  const [showPrivate, setShowPrivate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importData, setImportData] = useState("");
  const [activeTab, setActiveTab] = useState<"coins" | "dna" | "security">("coins");
  const [keyCeremony, setKeyCeremony] = useState<string | null>(null);
  const [keySaved, setKeySaved] = useState(false);
  const [showImportCoins, setShowImportCoins] = useState(false);
  const [importCoinsData, setImportCoinsData] = useState("");
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; errors: number } | null>(null);

  const addCoin = useStore((s) => s.addCoin);

  const signedCoins = useMemo(() => coins.filter((c) => c.signed), [coins]);
  const unsignedCoins = useMemo(() => coins.filter((c) => !c.signed), [coins]);

  const handleImportCoins = useCallback(() => {
    if (!importCoinsData.trim()) return;
    const spentHashes = useStore.getState().spentHashes;
    const existingHashes = new Set([...coins.map((c) => c.serialHash), ...spentHashes]);
    let added = 0, skipped = 0, errors = 0;
    const newCoins: MinedCoin[] = [];

    const lines = importCoinsData.trim().split("\n");
    for (const line of lines) {
      try {
        const entry = JSON.parse(line.trim());
        if (entry.unsent) { errors++; continue; }

        const parseCoin = (coinObj: Record<string, unknown>, gene?: string) => {
          const coinGene = (gene || coinObj.coinGene || "") as string;
          if (!coinGene) return;
          const serialHash = coinObj.serialHash as string;
          if (!serialHash || existingHashes.has(serialHash)) { skipped++; return; }

          let aminoAcids: string[] | undefined;
          try {
            const r = ribosome(coinGene);
            if (r.proteins[0]) aminoAcids = r.proteins[0].aminoAcids;
          } catch { /* skip */ }

          const proof = (coinObj.miningProof || {}) as Record<string, unknown>;

          const minedCoin: MinedCoin = {
            coinGene,
            serial: (coinObj.serial || "") as string,
            serialHash,
            aminoAcids,
            nonce: (proof.nonce ?? coinObj.nonce ?? 0) as number,
            hash: (proof.hash ?? coinObj.hash ?? "") as string,
            difficulty: (proof.difficulty ?? coinObj.difficulty ?? "") as string,
            minedAt: Date.now(),
            signed: true,
            networkSignature: coinObj.networkSignature as string | undefined,
            networkId: coinObj.networkId as string | undefined,
            networkGenome: coinObj.networkGenome as string | undefined,
            rflpFingerprint: coinObj.rflpFingerprint as MinedCoin["rflpFingerprint"],
          };

          newCoins.push(minedCoin);
          existingHashes.add(serialHash);
          added++;
        };

        if (entry.coin) parseCoin(entry.coin);
        if (entry.bonusCoins && Array.isArray(entry.bonusCoins)) {
          for (const bc of entry.bonusCoins) parseCoin(bc, bc.coinGene);
        }
      } catch {
        errors++;
      }
    }

    if (newCoins.length > 0) {
      const s = useStore.getState();
      let dna = s.wallet?.dna ?? "";
      for (const c of newCoins) {
        addCoin(c);
        try { dna = integrateCoinGene(dna, c.coinGene); } catch { /* skip */ }
      }
      if (s.wallet) {
        useStore.setState({ wallet: { ...s.wallet, dna } });
      }
    }

    setImportResult({ added, skipped, errors });
    if (added > 0) addToast("success", `Imported ${added} coin${added > 1 ? "s" : ""} into your wallet!`);
    else if (skipped > 0) addToast("info", "All coins already in your wallet.");
    else addToast("error", "No valid coins found in the data.");
  }, [importCoinsData, coins, addCoin, addToast]);

  const walletView = useMemo(() => {
    if (!wallet) return null;
    try { return viewWallet(wallet.dna); }
    catch { return null; }
  }, [wallet]);

  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const netInfo = await api.getDifficulty();
      const w = createWallet(6000, netInfo.networkGenome, netInfo.networkId);
      const local: LocalWallet = {
        id: w.publicKeyHash.slice(0, 16),
        dna: w.dna,
        privateKeyDNA: null,
        publicKeyHash: w.publicKeyHash,
        ownershipProofHash: w.ownershipProofHash,
        networkGenome: w.networkGenome,
        networkId: w.networkId,
        createdAt: w.createdAt,
      };
      setWallet(local);
      setKeyCeremony(w.privateKeyDNA);
      setKeySaved(false);
    } catch {
      addToast("error", "Could not reach network to get genome. Check your connection.");
    } finally {
      setCreating(false);
    }
  };

  const handleExport = () => {
    if (!wallet) return;
    const payload: Record<string, unknown> = {
      dna: wallet.dna,
      publicKeyHash: wallet.publicKeyHash,
      ownershipProofHash: wallet.ownershipProofHash,
      networkGenome: wallet.networkGenome,
      networkId: wallet.networkId,
      createdAt: wallet.createdAt,
    };
    if (wallet.privateKeyDNA) payload.privateKeyDNA = wallet.privateKeyDNA;
    const data = JSON.stringify(payload);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `biocrypt-wallet-${wallet.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("info", wallet.privateKeyDNA ? "Full wallet exported (includes private key)." : "Wallet data exported (no private key).");
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importData);
      if (!parsed.dna || !parsed.privateKeyDNA || !parsed.publicKeyHash) {
        throw new Error("Missing fields");
      }
      if (wallet && !confirm("This will replace your current wallet. Make sure you have a backup. Continue?")) {
        return;
      }
      const local: LocalWallet = {
        id: parsed.publicKeyHash.slice(0, 16),
        dna: parsed.dna,
        privateKeyDNA: parsed.privateKeyDNA,
        publicKeyHash: parsed.publicKeyHash,
        ownershipProofHash: parsed.ownershipProofHash || "",
        networkGenome: parsed.networkGenome || "",
        networkId: parsed.networkId || "",
        createdAt: parsed.createdAt || Date.now(),
      };
      setWallet(local);
      setImporting(false);
      setImportData("");
      addToast("success", "Wallet imported successfully.");
    } catch {
      addToast("error", "Invalid wallet data. Check the format and try again.");
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportData(reader.result as string);
    reader.readAsText(file);
  };

  if (!wallet) {
    return (
      <div className="page">
        <h1>Wallet</h1>
        <div className="onboarding-container">
          <div className="onboarding-hero">
            <div className="onboarding-icon">{"\u{1F9EC}"}</div>
            <h2>Your Biological Wallet</h2>
            <p className="text-muted" style={{ maxWidth: 500, margin: "0 auto 2rem", lineHeight: 1.7 }}>
              Create a unique DNA wallet to mine, store, and transfer BioCrypt coins.
              Your wallet is a living DNA strand that mutates as you earn and spend coins.
              Everything stays in your browser &mdash; your keys, your rules.
            </p>
          </div>
          <div className="onboarding-grid">
            <div className="onboarding-card" onClick={creating ? undefined : handleCreate} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()} style={creating ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
              <div className="onboarding-card-icon">{"\u2728"}</div>
              <h3>Create New Wallet</h3>
              <p className="text-muted text-sm">
                Generate a fresh 6,000-base DNA strand with a unique private key.
                Your wallet embeds the network's genome for offline coin verification.
              </p>
              <span className="btn btn-primary mt-2">{creating ? "Connecting to Network..." : "Create Wallet"}</span>
            </div>
            <div className="onboarding-card" onClick={() => setImporting(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setImporting(true)}>
              <div className="onboarding-card-icon">{"\u{1F4E5}"}</div>
              <h3>Import Existing</h3>
              <p className="text-muted text-sm">
                Already have a wallet? Import your JSON backup file or paste the data
                to restore your coins.
              </p>
              <span className="btn btn-secondary mt-2">Import Wallet</span>
            </div>
          </div>

          {importing && (
            <div className="card mt-3" style={{ maxWidth: 600, margin: "1.5rem auto 0" }}>
              <h3>Import Wallet</h3>
              <div className="field">
                <label className="label">Upload wallet JSON file</label>
                <input type="file" accept=".json" onChange={handleFileImport}
                  style={{ color: "var(--text-muted)", fontSize: "0.85rem" }} />
              </div>
              <div className="field">
                <label className="label">Or paste wallet JSON</label>
                <textarea className="textarea" value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder='{"dna":"...","privateKeyDNA":"...","publicKeyHash":"..."}' />
              </div>
              <div className="flex gap-1">
                <button className="btn btn-primary" onClick={handleImport} disabled={!importData}>
                  Import
                </button>
                <button className="btn btn-secondary" onClick={() => { setImporting(false); setImportData(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="onboarding-features">
            <div className="feature-item">
              <span className="feature-check">{"\u2705"}</span>
              <span>Fully client-side &mdash; no server stores your keys</span>
            </div>
            <div className="feature-item">
              <span className="feature-check">{"\u2705"}</span>
              <span>Offline-capable transfers via mRNA files</span>
            </div>
            <div className="feature-item">
              <span className="feature-check">{"\u2705"}</span>
              <span>Cryptographic proof of ownership via DNA protein synthesis</span>
            </div>
            <div className="feature-item">
              <span className="feature-check">{"\u2705"}</span>
              <span>Export & backup anytime as JSON</span>
            </div>
          </div>
        </div>
        <style>{walletStyles}</style>
      </div>
    );
  }

  const balance = coins.length;

  return (
    <div className="page">
      <h1>Wallet</h1>

      {/* Balance Hero */}
      <div className="balance-hero card card-glow">
        <div className="balance-top">
          <div>
            <div className="text-xs text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Balance</div>
            <div className="balance-amount">
              <span className="balance-number">{balance}</span>
              <span className="balance-unit">ZBIO</span>
            </div>
          </div>
          <div className="balance-meta">
            <div className="meta-row">
              <span className="text-muted text-xs">Wallet ID</span>
              <span className="mono text-xs">{wallet.id}</span>
            </div>
            <div className="meta-row">
              <span className="text-muted text-xs">Created</span>
              <span className="text-xs">{new Date(wallet.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="meta-row">
              <span className="text-muted text-xs">DNA Length</span>
              <span className="mono text-xs">{wallet.dna.length.toLocaleString()} bases</span>
            </div>
          </div>
        </div>
        <div className="balance-pubkey">
          <span className="text-xs text-muted">Public Key Hash </span>
          <span className="mono text-xs" style={{ opacity: 0.7 }}>{wallet.publicKeyHash}</span>
          <button className="btn-icon" style={{ marginLeft: "0.5rem", width: 24, height: 24, fontSize: "0.7rem" }}
            onClick={() => { navigator.clipboard.writeText(wallet.publicKeyHash); addToast("info", "Public key copied!"); }}
            title="Copy public key">
            {"\u{1F4CB}"}
          </button>
        </div>
        <div className="balance-actions">
          <Link to="/mine" className="btn btn-primary">Mine More</Link>
          <Link to="/transfer" className="btn btn-secondary">Send / Receive</Link>
          <button className="btn btn-secondary" onClick={() => { setShowImportCoins(true); setImportResult(null); setImportCoinsData(""); }}>Import Mined Coins</button>
          <button className="btn btn-secondary" onClick={handleExport}>Export Wallet</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === "coins" ? "active" : ""}`} onClick={() => setActiveTab("coins")}>
          Coins ({signedCoins.length + unsignedCoins.length})
        </button>
        <button className={`tab-btn ${activeTab === "dna" ? "active" : ""}`} onClick={() => setActiveTab("dna")}>
          DNA Strand
        </button>
        <button className={`tab-btn ${activeTab === "security" ? "active" : ""}`} onClick={() => setActiveTab("security")}>
          Security
        </button>
      </div>

      {activeTab === "coins" && (
        <CoinsTab signedCoins={signedCoins} unsignedCoins={unsignedCoins} />
      )}

      {activeTab === "dna" && (
        <DnaTab wallet={wallet} walletView={walletView} />
      )}

      {activeTab === "security" && (
        <SecurityTab
          wallet={wallet}
          showPrivate={showPrivate}
          setShowPrivate={setShowPrivate}
          addToast={addToast}
          handleExport={handleExport}
          setWallet={setWallet}
        />
      )}

      {showImportCoins && (
        <div className="ceremony-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowImportCoins(false); }}>
          <div className="ceremony-modal">
            <div style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: "0.75rem" }}>{"\u26CF\uFE0F"}</div>
            <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Import Mined Coins</h2>
            <p className="text-muted text-sm" style={{ textAlign: "center", marginBottom: "1.5rem", lineHeight: 1.7 }}>
              Paste the contents of <code style={{ background: "var(--bg-surface)", padding: "0.15rem 0.4rem", borderRadius: 4, fontSize: "0.8rem" }}>biocrypt-mined.jsonl</code> from
              your headless miner, or upload the file directly. Each line is a signed coin response from the network.
            </p>

            <div className="field" style={{ marginBottom: "0.75rem" }}>
              <label className="label" style={{ fontSize: "0.8rem" }}>Upload .jsonl file</label>
              <input type="file" accept=".jsonl,.json,.txt" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => { setImportCoinsData(reader.result as string); setImportResult(null); };
                reader.readAsText(file);
              }} style={{ color: "var(--text-muted)", fontSize: "0.85rem" }} />
            </div>

            <div className="field" style={{ marginBottom: "1rem" }}>
              <label className="label" style={{ fontSize: "0.8rem" }}>Or paste JSONL data</label>
              <textarea className="textarea" value={importCoinsData}
                onChange={(e) => { setImportCoinsData(e.target.value); setImportResult(null); }}
                placeholder={'{"coin":{"serialHash":"...","networkSignature":"...",...},"blockReward":50,...}\n{"coin":{...},...}'}
                style={{ minHeight: 120, fontFamily: "var(--mono)", fontSize: "0.72rem" }} />
            </div>

            {importResult && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: "var(--radius)", marginBottom: "1rem",
                background: importResult.added > 0 ? "rgba(0,229,153,0.08)" : "rgba(210,153,34,0.08)",
                border: `1px solid ${importResult.added > 0 ? "rgba(0,229,153,0.2)" : "rgba(210,153,34,0.2)"}`,
                fontSize: "0.85rem" }}>
                <strong>{importResult.added}</strong> coin{importResult.added !== 1 ? "s" : ""} imported
                {importResult.skipped > 0 && <> &middot; <strong>{importResult.skipped}</strong> already in wallet</>}
                {importResult.errors > 0 && <> &middot; <strong>{importResult.errors}</strong> error{importResult.errors !== 1 ? "s" : ""}</>}
              </div>
            )}

            <div className="flex gap-1 justify-center">
              <button className="btn btn-primary" onClick={handleImportCoins}
                disabled={!importCoinsData.trim()}>
                Import Coins
              </button>
              <button className="btn btn-secondary" onClick={() => setShowImportCoins(false)}>
                {importResult && importResult.added > 0 ? "Done" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {keyCeremony && (
        <div className="ceremony-overlay">
          <div className="ceremony-modal">
            <div style={{ fontSize: "3rem", textAlign: "center", marginBottom: "1rem" }}>{"\u{1F510}"}</div>
            <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Save Your Private Key</h2>
            <p className="text-muted text-sm" style={{ textAlign: "center", marginBottom: "1.5rem", lineHeight: 1.7 }}>
              This is the <strong>only time</strong> your private key will be shown.
              It is <strong>never stored on our servers</strong> and will be removed from your browser
              after you close this dialog. Without it, you cannot prove ownership or recover your wallet.
            </p>
            <div className="ceremony-key-box">
              <DNAVisualization dna={keyCeremony} maxLength={300} />
              <div className="text-xs text-muted mt-1">{keyCeremony.length} bases</div>
            </div>
            <div className="flex gap-1 justify-center flex-wrap mt-2">
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard.writeText(keyCeremony);
                setKeySaved(true);
                addToast("info", "Private key copied to clipboard.");
              }}>Copy Key</button>
              <button className="btn btn-secondary" onClick={() => {
                const blob = new Blob([keyCeremony], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `biocrypt-private-key-${wallet!.id}.txt`; a.click();
                URL.revokeObjectURL(url);
                setKeySaved(true);
                addToast("info", "Private key downloaded.");
              }}>Download .txt</button>
              <button className="btn btn-secondary" onClick={() => {
                if (!wallet) return;
                const data = JSON.stringify({
                  dna: wallet.dna,
                  privateKeyDNA: keyCeremony,
                  publicKeyHash: wallet.publicKeyHash,
                  ownershipProofHash: wallet.ownershipProofHash,
                  networkGenome: wallet.networkGenome,
                  networkId: wallet.networkId,
                  createdAt: wallet.createdAt,
                });
                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `biocrypt-wallet-${wallet.id}.json`; a.click();
                URL.revokeObjectURL(url);
                setKeySaved(true);
                addToast("info", "Full wallet backup downloaded.");
              }}>Download Full Backup</button>
            </div>
            <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
              {keySaved ? (
                <button className="btn btn-primary btn-glow" onClick={() => {
                  setKeyCeremony(null);
                  addToast("success", "Wallet ready! Private key has been removed from memory.");
                }}>
                  I've Saved My Key — Continue
                </button>
              ) : (
                <p className="text-muted text-xs" style={{ fontStyle: "italic" }}>
                  Copy or download your key above before continuing.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{walletStyles}</style>
    </div>
  );
}

/* ─── Sub-Components ─── */

function CoinsTab({ signedCoins, unsignedCoins }: { signedCoins: MinedCoin[]; unsignedCoins: MinedCoin[] }) {
  if (signedCoins.length === 0 && unsignedCoins.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">{"\u26CF\uFE0F"}</div>
        <div className="empty-title">No coins yet</div>
        <div className="empty-desc">
          Start mining to earn your first BioCrypt coin. Each coin is a unique protein encoded in your DNA wallet.
        </div>
        <Link to="/mine" className="btn btn-primary">Start Mining</Link>
      </div>
    );
  }

  return (
    <div>
      {unsignedCoins.length > 0 && (
        <div className="mb-3">
          <h3>Unsigned ({unsignedCoins.length})</h3>
          <p className="text-muted text-sm mb-2">These coins need network signing before they can be transferred.</p>
          {unsignedCoins.map((c) => (
            <CoinRow key={c.serialHash} coin={c} />
          ))}
        </div>
      )}
      <h3>Signed Coins ({signedCoins.length})</h3>
      {signedCoins.length === 0 ? (
        <p className="text-muted text-sm">No signed coins yet. Submit mined coins to the network for signing.</p>
      ) : (
        <div className="coin-grid">
          {signedCoins.map((c) => (
            <CoinCard key={c.serialHash} coin={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CoinCard({ coin }: { coin: MinedCoin }) {
  return (
    <div className="wc-card">
      <div className="wc-top">
        <span className="badge badge-primary">Signed</span>
        <span className="text-xs text-muted">{new Date(coin.minedAt).toLocaleDateString()}</span>
      </div>
      <div className="wc-serial">
        {coin.aminoAcids ? <ProteinBar aminoAcids={coin.aminoAcids} height={12} /> : <span className="mono text-xs">{coin.serialHash.slice(0, 24)}...</span>}
      </div>
      <div className="wc-bottom">
        <div>
          <div className="text-xs text-muted">Network</div>
          <div className="mono text-xs">{coin.networkId}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Nonce</div>
          <div className="mono text-xs">{coin.nonce.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Difficulty</div>
          <div className="mono text-xs">{coin.difficulty}</div>
        </div>
      </div>
    </div>
  );
}

function CoinRow({ coin }: { coin: MinedCoin }) {
  return (
    <div className="card mb-1 flex justify-between items-center flex-wrap" style={{ gap: "0.75rem" }}>
      <div className="flex items-center gap-1">
        <span className="badge badge-warning">Unsigned</span>
        {coin.aminoAcids ? <ProteinBar aminoAcids={coin.aminoAcids} height={10} maxWidth={140} /> : <span className="mono text-xs">{coin.serialHash.slice(0, 24)}...</span>}
      </div>
      <span className="text-xs text-muted">{new Date(coin.minedAt).toLocaleString()}</span>
    </div>
  );
}

function DnaTab({ wallet, walletView }: { wallet: { dna: string; id: string }; walletView: { proteinCount: number; coinCount: number } | null }) {
  return (
    <div>
      <div className="card mb-2">
        <h3>Wallet DNA Strand</h3>
        <p className="text-muted text-sm mb-2">
          Your wallet's DNA encodes all your coins as proteins. The strand mutates each time you mine, send, or receive a coin.
        </p>
        <DNAVisualization dna={wallet.dna} maxLength={1200} />
        <div className="flex gap-2 mt-1 flex-wrap" style={{ alignItems: "center" }}>
          <span className="text-xs text-muted">{wallet.dna.length.toLocaleString()} bases</span>
          {walletView && (
            <>
              <span className="text-xs text-muted">&middot; {walletView.proteinCount} proteins</span>
              <span className="text-xs text-muted">&middot; {walletView.coinCount} coin proteins</span>
            </>
          )}
        </div>
      </div>
      <WalletOrganism dna={wallet.dna} />
      <div className="card">
        <h3>How Your DNA Works</h3>
        <div className="dna-explainer-grid">
          <div className="dna-explain">
            <div className="dna-explain-icon">{"\u{1F9EC}"}</div>
            <div>
              <strong>Living Storage</strong>
              <p className="text-muted text-xs">Your DNA stores coins as protein-coding genes. The ribosome reads it to count your balance.</p>
            </div>
          </div>
          <div className="dna-explain">
            <div className="dna-explain-icon">{"\u{1F510}"}</div>
            <div>
              <strong>Private Key Protection</strong>
              <p className="text-muted text-xs">Only your private key DNA can combine with the wallet DNA to produce the unlocking protein.</p>
            </div>
          </div>
          <div className="dna-explain">
            <div className="dna-explain-icon">{"\u{1F9EA}"}</div>
            <div>
              <strong>Mutation = Transaction</strong>
              <p className="text-muted text-xs">Sending a coin removes its gene from your DNA. Receiving one mutates it in. Like biology.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const AMINO_COLORS: Record<string, string> = {
  Met: "#22c55e", Gly: "#a855f7", Trp: "#ec4899", Cys: "#eab308",
  Phe: "#f97316", Leu: "#3b82f6", Ile: "#06b6d4", Val: "#14b8a6",
  Ser: "#ef4444", Pro: "#8b5cf6", Thr: "#10b981", Ala: "#6366f1",
  Tyr: "#f59e0b", His: "#d946ef", Gln: "#0ea5e9", Asn: "#84cc16",
  Lys: "#f43f5e", Asp: "#fb923c", Glu: "#38bdf8", Arg: "#c084fc",
};
const AA_FALLBACK = "#334155";

function WalletOrganism({ dna }: { dna: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<{ protein: Protein; isCoin: boolean } | null>(null);

  const result = useMemo(() => {
    try { return ribosome(dna); }
    catch { return null; }
  }, [dna]);

  const blocks = useMemo(() => {
    if (!result) return [];
    return result.proteins.map((p) => ({ protein: p, isCoin: isCoinProtein(p) }));
  }, [result]);

  const stats = useMemo(() => {
    if (!blocks.length) return null;
    const coins = blocks.filter((b) => b.isCoin).length;
    return { coins, structural: blocks.length - coins, total: blocks.length, acids: blocks.reduce((s, b) => s + b.protein.aminoAcids.length, 0) };
  }, [blocks]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !blocks.length) return;
    const SQ = 3, GAP = 1, PGAP = 2;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.parentElement?.clientWidth || 800;
    const cols = Math.floor(cw / (SQ + GAP));

    type Cell = { color: string; pi: number } | { gap: true };
    const cells: Cell[] = [];
    for (let pi = 0; pi < blocks.length; pi++) {
      if (pi > 0) for (let g = 0; g < PGAP; g++) cells.push({ gap: true } as Cell);
      for (const aa of blocks[pi].protein.aminoAcids) cells.push({ color: AMINO_COLORS[aa] || AA_FALLBACK, pi });
    }

    const rows = Math.ceil(cells.length / cols);
    const w = cols * (SQ + GAP), h = rows * (SQ + GAP);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);

    const selIdx = selected ? blocks.indexOf(selected) : -1;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const x = (i % cols) * (SQ + GAP), y = Math.floor(i / cols) * (SQ + GAP);
      if ("gap" in cell) { ctx.fillStyle = "#1e293b"; ctx.globalAlpha = 0.3; ctx.fillRect(x, y, SQ, SQ); ctx.globalAlpha = 1; }
      else {
        ctx.fillStyle = cell.color;
        ctx.globalAlpha = (selIdx >= 0 && cell.pi !== selIdx) ? 0.25 : 1;
        ctx.fillRect(x, y, SQ, SQ); ctx.globalAlpha = 1;
        if (cell.pi === selIdx) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.5; ctx.strokeRect(x - 0.5, y - 0.5, SQ + 1, SQ + 1); }
      }
    }
    (canvas as any).__cells = cells;
    (canvas as any).__cols = cols;
  }, [blocks, selected]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { const h = () => draw(); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cells: any[] = (canvas as any).__cells;
    const cols: number = (canvas as any).__cols;
    if (!cells || !cols) return;
    const rect = canvas.getBoundingClientRect();
    const idx = Math.floor((e.clientY - rect.top) / 4) * cols + Math.floor((e.clientX - rect.left) / 4);
    if (idx >= 0 && idx < cells.length && !("gap" in cells[idx])) {
      const pi = cells[idx].pi;
      setSelected((prev) => (prev && blocks.indexOf(prev) === pi ? null : blocks[pi]));
    }
  }, [blocks]);

  if (!blocks.length) return null;

  return (
    <div className="card mb-2">
      <h3>Wallet Organism</h3>
      <p className="text-muted text-sm mb-2">
        Your wallet's DNA as a living organism — every protein synthesized by the ribosome, shown as colored amino acid squares.
      </p>
      {stats && (
        <div className="wo-stats">
          <span className="wo-stat"><strong>{stats.total}</strong> proteins</span>
          <span className="wo-stat" style={{ color: "#22c55e" }}><strong>{stats.coins}</strong> coins</span>
          <span className="wo-stat" style={{ color: "#a855f7" }}><strong>{stats.structural}</strong> structural</span>
          <span className="wo-stat"><strong>{stats.acids.toLocaleString()}</strong> amino acids</span>
        </div>
      )}
      <div className="wo-canvas-wrap">
        <canvas ref={canvasRef} onClick={handleClick} style={{ cursor: "crosshair", imageRendering: "pixelated" }} />
      </div>
      {selected && (
        <div className="wo-detail">
          <div className="flex justify-between items-center">
            <span className="text-sm">
              <strong>Protein #{selected.protein.index + 1}</strong>
              <span className={`badge ml-1 ${selected.isCoin ? "badge-primary" : "badge-secondary"}`}>
                {selected.isCoin ? "Coin" : "Structural"}
              </span>
            </span>
            <button className="btn btn-sm btn-secondary" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="text-xs text-muted mt-05">
            {selected.protein.aminoAcids.length} amino acids &middot;
            Position {selected.protein.startIndex.toLocaleString()} — {selected.protein.stopIndex.toLocaleString()}
          </div>
          <div className="wo-detail-bar mt-05">
            {selected.protein.aminoAcids.map((aa, i) => (
              <span key={i} style={{ display: "inline-block", width: Math.max(2, Math.min(6, Math.floor(500 / selected.protein.aminoAcids.length))), height: 14, backgroundColor: AMINO_COLORS[aa] || AA_FALLBACK }} title={aa} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SecurityTab({ wallet, showPrivate, setShowPrivate, addToast, handleExport, setWallet }: {
  wallet: { privateKeyDNA: string | null; id: string };
  showPrivate: boolean;
  setShowPrivate: (v: boolean) => void;
  addToast: (type: "success" | "error" | "info", msg: string) => void;
  handleExport: () => void;
  setWallet: (w: null) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasKey = !!wallet.privateKeyDNA;

  return (
    <div>
      <div className="card mb-2">
        <h3>Private Key</h3>
        {hasKey ? (
          <>
            <div className="security-warning mb-2">
              <strong>{"\u26A0\uFE0F"} Never share your private key.</strong> Anyone with your private key DNA can spend your coins.
            </div>
            {showPrivate ? (
              <>
                <DNAVisualization dna={wallet.privateKeyDNA!} maxLength={400} />
                <div className="text-xs text-muted mt-1 mb-2">{wallet.privateKeyDNA!.length} bases</div>
                <div className="flex gap-1 flex-wrap">
                  <button className="btn btn-sm btn-secondary" onClick={() => setShowPrivate(false)}>Hide Key</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => {
                    navigator.clipboard.writeText(wallet.privateKeyDNA!);
                    addToast("info", "Private key copied to clipboard.");
                  }}>Copy Key</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => {
                    const blob = new Blob([wallet.privateKeyDNA!], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `biocrypt-private-key-${wallet.id}.txt`; a.click();
                    URL.revokeObjectURL(url);
                    addToast("info", "Private key downloaded.");
                  }}>Download .txt</button>
                </div>
              </>
            ) : (
              <button className="btn btn-secondary" onClick={() => setShowPrivate(true)}>
                Reveal Private Key
              </button>
            )}
          </>
        ) : (
          <div style={{ padding: "1rem", background: "var(--bg-surface)", borderRadius: "var(--radius)" }}>
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              {"\u2705"} <strong>Private key not stored in browser.</strong> Your private key was shown only
              at wallet creation. If you saved it (via copy, download, or full backup), you can use it
              to prove ownership or import your wallet on another device.
            </p>
          </div>
        )}
      </div>

      <div className="card mb-2">
        <h3>Backup & Export</h3>
        <p className="text-muted text-sm mb-2">
          Export your wallet DNA and public key. To create a full backup including your private key,
          you must save it during wallet creation.
        </p>
        <button className="btn btn-primary" onClick={handleExport}>Export Wallet Data</button>
      </div>

      <div className="card card-danger-zone">
        <h3 style={{ color: "var(--danger)" }}>Danger Zone</h3>
        <p className="text-muted text-sm mb-2">
          Deleting your wallet removes all data from this browser. Make sure you have exported a backup first.
        </p>
        {!confirmDelete ? (
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
            Delete Wallet
          </button>
        ) : (
          <div className="flex gap-1 items-center flex-wrap">
            <span className="text-sm" style={{ color: "var(--danger)" }}>Are you sure? This cannot be undone.</span>
            <button className="btn btn-danger btn-sm" onClick={() => { setWallet(null); setConfirmDelete(false); }}>
              Yes, Delete
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Styles ─── */

const walletStyles = `
/* Onboarding */
.onboarding-container { max-width: 700px; margin: 0 auto; }
.onboarding-hero { text-align: center; margin-bottom: 2rem; }
.onboarding-icon { font-size: 4rem; margin-bottom: 1rem; }
.onboarding-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;
}
.onboarding-card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 2rem 1.5rem; text-align: center; cursor: pointer;
  transition: all 0.2s;
}
.onboarding-card:hover {
  border-color: var(--primary); box-shadow: 0 0 30px var(--primary-glow);
  transform: translateY(-2px);
}
.onboarding-card:focus-visible {
  outline: 2px solid var(--primary); outline-offset: 2px;
}
.onboarding-card-icon { font-size: 2.5rem; margin-bottom: 1rem; }
.onboarding-card h3 { margin-bottom: 0.5rem; }
.onboarding-features {
  margin-top: 2.5rem; display: flex; flex-direction: column; gap: 0.75rem;
  padding: 1.5rem; background: var(--bg-card); border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}
.feature-item {
  display: flex; align-items: center; gap: 0.75rem; font-size: 0.9rem; color: var(--text-muted);
}
.feature-check { font-size: 1.1rem; }

/* Balance Hero */
.balance-hero {
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, var(--bg-card) 0%, rgba(0,229,153,0.03) 100%);
}
.balance-top {
  display: flex; justify-content: space-between; align-items: flex-start;
  flex-wrap: wrap; gap: 1.5rem; margin-bottom: 1rem;
}
.balance-amount { display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.25rem; }
.balance-number {
  font-family: var(--mono); font-size: 3rem; font-weight: 800;
  color: var(--primary); line-height: 1;
}
.balance-unit { font-size: 1rem; font-weight: 600; color: var(--text-muted); }
.balance-meta { display: flex; flex-direction: column; gap: 0.4rem; }
.meta-row { display: flex; gap: 0.75rem; align-items: center; }
.balance-pubkey {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;
  padding: 0.75rem; background: var(--bg-surface); border-radius: var(--radius);
  margin-bottom: 1.25rem; word-break: break-all;
}
.balance-actions {
  display: flex; gap: 0.75rem; flex-wrap: wrap;
}
.balance-actions .btn { text-decoration: none; }

/* Coin grid */
.coin-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;
}
.wc-card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 1.25rem; transition: border-color 0.2s;
}
.wc-card:hover { border-color: var(--border-bright); }
.wc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.wc-serial { margin-bottom: 0.75rem; word-break: break-all; }
.wc-bottom { display: flex; gap: 1.5rem; flex-wrap: wrap; }

/* DNA explain */
.dna-explainer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
.dna-explain { display: flex; gap: 0.75rem; align-items: flex-start; }
.dna-explain-icon { font-size: 1.5rem; flex-shrink: 0; }
.dna-explain strong { font-size: 0.85rem; }

/* Security */
.security-warning {
  padding: 0.75rem 1rem; border-radius: var(--radius);
  background: rgba(210,153,34,0.08); border: 1px solid rgba(210,153,34,0.2);
  font-size: 0.85rem; color: var(--warning); line-height: 1.5;
}
.card-danger-zone {
  border-color: rgba(248,81,73,0.2);
}
.card-danger-zone:hover { border-color: rgba(248,81,73,0.4); }

/* Key ceremony modal */
.ceremony-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.ceremony-modal {
  background: var(--bg-card); border: 1px solid var(--primary);
  border-radius: var(--radius-lg); padding: 2rem;
  max-width: 560px; width: 100%;
  box-shadow: 0 0 60px var(--primary-glow);
  max-height: 90vh; overflow-y: auto;
}
.ceremony-key-box {
  padding: 1rem; background: var(--bg-surface);
  border-radius: var(--radius); border: 1px solid var(--border);
}

@media (max-width: 640px) {
  .balance-number { font-size: 2.25rem; }
  .coin-grid { grid-template-columns: 1fr; }
  .onboarding-grid { grid-template-columns: 1fr; }
  .ceremony-modal { padding: 1.25rem; }
}
.wo-stats {
  display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; margin-bottom: 0.75rem;
  font-size: 0.8rem;
}
.wo-stat strong { font-family: var(--mono); }
.wo-canvas-wrap {
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 0.5rem; overflow: hidden; margin-bottom: 0.5rem;
}
.wo-canvas-wrap canvas { display: block; width: 100%; }
.wo-detail {
  padding: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius); margin-top: 0.5rem;
}
.wo-detail-bar {
  display: flex; flex-wrap: wrap;
  padding: 0.35rem; background: var(--bg-card); border-radius: var(--radius);
}
`;
