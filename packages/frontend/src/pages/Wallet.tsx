import { useState } from "react";
import { createWallet, viewWallet, type Wallet as CoreWallet } from "@zcoin/core";
import { useStore, type LocalWallet } from "../store";
import { DNAVisualization } from "../components/DNAVisualization";

export function Wallet() {
  const wallet = useStore((s) => s.wallet);
  const coins = useStore((s) => s.coins);
  const setWallet = useStore((s) => s.setWallet);
  const addToast = useStore((s) => s.addToast);
  const [showPrivate, setShowPrivate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importData, setImportData] = useState("");

  const handleCreate = () => {
    const w = createWallet(6000);
    const local: LocalWallet = {
      id: w.publicKeyHash.slice(0, 16),
      dna: w.dna,
      privateKeyDNA: w.privateKeyDNA,
      publicKeyHash: w.publicKeyHash,
      ownershipProofHash: w.ownershipProofHash,
      createdAt: w.createdAt,
    };
    setWallet(local);
    addToast("success", "Wallet created! Your private key is stored locally.");
  };

  const handleExport = () => {
    if (!wallet) return;
    const data = JSON.stringify({
      dna: wallet.dna,
      privateKeyDNA: wallet.privateKeyDNA,
      publicKeyHash: wallet.publicKeyHash,
      ownershipProofHash: wallet.ownershipProofHash,
      createdAt: wallet.createdAt,
    });
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zcoin-wallet-${wallet.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("info", "Wallet exported.");
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importData);
      if (!parsed.dna || !parsed.privateKeyDNA || !parsed.publicKeyHash) {
        throw new Error("Missing fields");
      }
      const local: LocalWallet = {
        id: parsed.publicKeyHash.slice(0, 16),
        dna: parsed.dna,
        privateKeyDNA: parsed.privateKeyDNA,
        publicKeyHash: parsed.publicKeyHash,
        ownershipProofHash: parsed.ownershipProofHash || "",
        createdAt: parsed.createdAt || Date.now(),
      };
      setWallet(local);
      setImporting(false);
      setImportData("");
      addToast("success", "Wallet imported successfully.");
    } catch {
      addToast("error", "Invalid wallet data.");
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportData(reader.result as string);
    };
    reader.readAsText(file);
  };

  const walletView = wallet ? (() => {
    try { return viewWallet(wallet.dna); }
    catch { return null; }
  })() : null;

  const signedCoins = coins.filter((c) => c.signed);

  return (
    <div className="page">
      <h1>Wallet</h1>

      {!wallet ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>No wallet found</h2>
          <p className="text-muted mb-2">Create a new wallet or import an existing one.</p>
          <div className="flex items-center gap-2" style={{ justifyContent: "center" }}>
            <button className="btn btn-primary btn-lg" onClick={handleCreate}>
              Create Wallet
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => setImporting(true)}>
              Import Wallet
            </button>
          </div>
          {importing && (
            <div className="mt-3" style={{ textAlign: "left" }}>
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
              <button className="btn btn-primary" onClick={handleImport} disabled={!importData}>
                Import
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="card mb-2">
            <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div className="text-xs text-muted">Wallet ID</div>
                <div className="mono" style={{ fontSize: "0.9rem" }}>{wallet.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Public Key Hash</div>
                <div className="mono text-sm truncate" style={{ maxWidth: 300 }}>
                  {wallet.publicKeyHash}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">Coins</div>
                <div className="text-primary mono" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  {walletView?.coinCount ?? signedCoins.length}
                </div>
              </div>
            </div>
          </div>

          <div className="card-grid">
            <div className="card">
              <h2>DNA Strand</h2>
              <DNAVisualization dna={wallet.dna} />
              <div className="text-xs text-muted mt-1">
                {wallet.dna.length} bases
                {walletView && ` | ${walletView.proteinCount} proteins`}
              </div>
            </div>

            <div className="card">
              <h2>Private Key</h2>
              {showPrivate ? (
                <>
                  <DNAVisualization dna={wallet.privateKeyDNA} maxLength={300} />
                  <button className="btn btn-sm btn-secondary mt-1"
                    onClick={() => setShowPrivate(false)}>Hide</button>
                </>
              ) : (
                <>
                  <p className="text-muted text-sm mb-2">
                    Your private key DNA is stored locally in your browser.
                    Never share it with anyone.
                  </p>
                  <button className="btn btn-sm btn-secondary"
                    onClick={() => setShowPrivate(true)}>Reveal Private Key</button>
                </>
              )}
            </div>
          </div>

          {signedCoins.length > 0 && (
            <div className="mt-3">
              <h2>Signed Coins ({signedCoins.length})</h2>
              <div className="card-grid">
                {signedCoins.map((c) => (
                  <div key={c.serialHash} className="card">
                    <div className="flex justify-between items-center">
                      <span className="badge badge-primary">Signed</span>
                      <span className="text-xs text-muted">
                        {new Date(c.minedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-1">
                      <div className="text-xs text-muted">Serial Hash</div>
                      <div className="mono text-xs truncate">{c.serialHash}</div>
                    </div>
                    <div className="mt-1">
                      <div className="text-xs text-muted">Network</div>
                      <div className="mono text-xs">{c.networkId}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button className="btn btn-secondary" onClick={handleExport}>Export Wallet</button>
            <button className="btn btn-danger btn-sm"
              onClick={() => { if (confirm("Delete wallet? Make sure you exported it first.")) setWallet(null); }}>
              Delete Wallet
            </button>
          </div>
        </>
      )}
    </div>
  );
}
