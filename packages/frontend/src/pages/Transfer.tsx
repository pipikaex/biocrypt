import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  createMRNA, serializeMRNA, serializeBundle, parseMRNAData, applyMRNABundle,
} from "@zcoin/core";
import { useStore, type MinedCoin } from "../store";
import { api } from "../api";

export function Transfer() {
  const wallet = useStore((s) => s.wallet);
  const coins = useStore((s) => s.coins);
  const setWallet = useStore((s) => s.setWallet);
  const removeCoin = useStore((s) => s.removeCoin);
  const addToast = useStore((s) => s.addToast);

  const [tab, setTab] = useState<"send" | "receive">("send");

  if (!wallet) {
    return (
      <div className="page">
        <h1>Transfer Coins</h1>
        <div className="empty-state">
          <div className="empty-icon">{"\u{1F4E8}"}</div>
          <div className="empty-title">Wallet Required</div>
          <div className="empty-desc">Create or import a wallet to send and receive zBioCoins.</div>
          <Link to="/wallet" className="btn btn-primary">Go to Wallet</Link>
        </div>
        <style>{transferStyles}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Transfer Coins</h1>
      <p className="text-muted mb-2" style={{ maxWidth: 600 }}>
        Send one or multiple coins at once by creating an mRNA transfer file, or receive coins by applying
        an mRNA payload to your wallet. Transfers work <strong>offline</strong> &mdash; no server needed.
      </p>

      <div className="tabs">
        <button className={`tab-btn ${tab === "send" ? "active" : ""}`} onClick={() => setTab("send")}>
          {"\u{1F4E4}"} Send
        </button>
        <button className={`tab-btn ${tab === "receive" ? "active" : ""}`} onClick={() => setTab("receive")}>
          {"\u{1F4E5}"} Receive
        </button>
      </div>

      {tab === "send" ? (
        <SendFlow wallet={wallet} coins={coins} setWallet={setWallet} removeCoin={removeCoin} addToast={addToast} />
      ) : (
        <ReceiveFlow wallet={wallet} setWallet={setWallet} addToast={addToast} />
      )}

      <div className="card mt-3">
        <h3>How Transfers Work</h3>
        <div className="transfer-explainer">
          <div className="te-step">
            <div className="te-num">1</div>
            <div>
              <strong>Select coins</strong>
              <p className="text-muted text-xs">Pick one or many coins to transfer at once.</p>
            </div>
          </div>
          <div className="te-step">
            <div className="te-num">2</div>
            <div>
              <strong>Create mRNA bundle</strong>
              <p className="text-muted text-xs">Each coin gene is extracted from your DNA into an mRNA payload.</p>
            </div>
          </div>
          <div className="te-step">
            <div className="te-num">3</div>
            <div>
              <strong>Share with recipient</strong>
              <p className="text-muted text-xs">Send the .mrna file via any channel &mdash; email, chat, QR, USB.</p>
            </div>
          </div>
          <div className="te-step">
            <div className="te-num">4</div>
            <div>
              <strong>Recipient applies</strong>
              <p className="text-muted text-xs">All coins are spliced into their DNA at once. Nullifiers prevent double-spend.</p>
            </div>
          </div>
        </div>
      </div>

      <style>{transferStyles}</style>
    </div>
  );
}

/* ─── Send Flow ─── */

function SendFlow({ wallet, coins, setWallet, removeCoin, addToast }: {
  wallet: { dna: string; privateKeyDNA: string | null; publicKeyHash: string; networkGenome: string; networkId: string };
  coins: MinedCoin[];
  setWallet: (w: any) => void;
  removeCoin: (hash: string) => void;
  addToast: (type: "success" | "error" | "info", msg: string) => void;
}) {
  const signedCoins = useMemo(() => coins.filter((c) => c.signed), [coins]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [recipientKey, setRecipientKey] = useState("");
  const [privateKey, setPrivateKey] = useState(wallet.privateKeyDNA || "");
  const [mrnaOutput, setMrnaOutput] = useState("");
  const [sending, setSending] = useState(false);

  const selectedCoins = useMemo(
    () => signedCoins.filter((c) => selectedHashes.has(c.serialHash)),
    [signedCoins, selectedHashes],
  );

  const toggleCoin = (hash: string) => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedHashes.size === signedCoins.length) {
      setSelectedHashes(new Set());
    } else {
      setSelectedHashes(new Set(signedCoins.map((c) => c.serialHash)));
    }
  };

  const handleKeyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string).trim();
      if (/^[TACG]+$/.test(text)) {
        setPrivateKey(text);
        addToast("info", "Private key loaded from file.");
      } else {
        addToast("error", "Invalid key file — must contain only T, A, C, G characters.");
      }
    };
    reader.readAsText(file);
  };

  const handleCreateTransfer = () => {
    if (selectedCoins.length === 0 || !privateKey) return;
    setSending(true);
    try {
      let currentDna = wallet.dna;
      const mrnas: ReturnType<typeof createMRNA>["mrna"][] = [];

      for (const coin of selectedCoins) {
        const result = createMRNA(
          currentDna,
          privateKey,
          coin.serialHash,
          recipientKey || null,
          coin.networkSignature!,
          coin.networkId!,
          coin.networkGenome || wallet.networkGenome || "",
          { nonce: coin.nonce, hash: coin.hash, difficulty: coin.difficulty },
          [],
          coin.rflpFingerprint,
        );
        currentDna = result.modifiedSenderDNA;
        mrnas.push(result.mrna);
      }

      setWallet({ ...wallet, dna: currentDna });
      for (const coin of selectedCoins) {
        removeCoin(coin.serialHash);
      }

      const serialized = mrnas.length === 1
        ? serializeMRNA(mrnas[0])
        : serializeBundle(mrnas);
      setMrnaOutput(serialized);
      setStep(3);
      addToast("success", `Transfer created for ${mrnas.length} coin${mrnas.length > 1 ? "s" : ""}.`);
    } catch (err: any) {
      addToast("error", `Transfer failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleDownload = () => {
    if (!mrnaOutput) return;
    const blob = new Blob([mrnaOutput], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zcoin-transfer-${selectedCoins.length > 1 ? `${selectedCoins.length}coins-` : ""}${Date.now()}.mrna`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("info", "Transfer file downloaded.");
  };

  const reset = () => {
    setStep(1);
    setSelectedHashes(new Set());
    setRecipientKey("");
    setMrnaOutput("");
  };

  return (
    <div>
      {/* Stepper */}
      <div className="stepper">
        <div className={`step ${step >= 1 ? (step > 1 ? "done" : "active") : ""}`}>
          <div className="step-num">{step > 1 ? "\u2713" : "1"}</div>
          <span className="hide-mobile">Select Coins</span>
        </div>
        <div className={`step-line ${step > 1 ? "done" : ""}`} />
        <div className={`step ${step >= 2 ? (step > 2 ? "done" : "active") : ""}`}>
          <div className="step-num">{step > 2 ? "\u2713" : "2"}</div>
          <span className="hide-mobile">Confirm</span>
        </div>
        <div className={`step-line ${step > 2 ? "done" : ""}`} />
        <div className={`step ${step >= 3 ? "active" : ""}`}>
          <div className="step-num">3</div>
          <span className="hide-mobile">Share</span>
        </div>
      </div>

      {step === 1 && (
        <div>
          {signedCoins.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{"\u{1FA99}"}</div>
              <div className="empty-title">No coins to send</div>
              <div className="empty-desc">Mine and get coins signed by the network before you can transfer them.</div>
              <Link to="/mine" className="btn btn-primary">Start Mining</Link>
            </div>
          ) : (
            <>
              <div className="send-header">
                <h3>Select coins to send</h3>
                <div className="send-header-actions">
                  <button className="btn btn-sm btn-secondary" onClick={selectAll}>
                    {selectedHashes.size === signedCoins.length ? "Deselect All" : "Select All"}
                  </button>
                  <span className="selection-count">
                    {selectedHashes.size} of {signedCoins.length} selected
                  </span>
                </div>
              </div>
              <div className="send-coin-grid">
                {signedCoins.map((c) => (
                  <div key={c.serialHash}
                    className={`send-coin-card ${selectedHashes.has(c.serialHash) ? "selected" : ""}`}
                    onClick={() => toggleCoin(c.serialHash)} role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && toggleCoin(c.serialHash)}>
                    <div className="coin-check">
                      <span className={`check-box ${selectedHashes.has(c.serialHash) ? "checked" : ""}`}>
                        {selectedHashes.has(c.serialHash) ? "\u2713" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="badge badge-primary">ZBIO</span>
                      <span className="text-xs text-muted">{new Date(c.minedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mono text-xs mt-1">{c.serialHash.slice(0, 28)}...</div>
                    <div className="text-xs text-muted mt-05">Network: {c.networkId} &middot; Nonce: {c.nonce.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              {selectedHashes.size > 0 && (
                <div className="send-footer">
                  <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                    Continue with {selectedHashes.size} coin{selectedHashes.size > 1 ? "s" : ""} {"\u2192"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 2 && selectedCoins.length > 0 && (
        <div className="card">
          <h3>Confirm Transfer</h3>
          <div className="confirm-summary">
            <div className="confirm-row">
              <span className="text-muted">Coins</span>
              <span className="mono text-sm" style={{ color: "var(--primary)", fontWeight: 700 }}>
                {selectedCoins.length} coin{selectedCoins.length > 1 ? "s" : ""}
              </span>
            </div>
            {selectedCoins.length <= 5 ? selectedCoins.map((coin) => (
              <div key={coin.serialHash} className="confirm-row">
                <span className="text-muted text-xs">Coin</span>
                <span className="mono text-xs">{coin.serialHash.slice(0, 24)}...</span>
              </div>
            )) : (
              <div className="confirm-row">
                <span className="text-muted text-xs">Serials</span>
                <span className="text-xs">{selectedCoins.length} coins selected (too many to list)</span>
              </div>
            )}
            <div className="confirm-row">
              <span className="text-muted">Network</span>
              <span className="mono text-xs">{selectedCoins[0].networkId}</span>
            </div>
          </div>

          <div className="field mt-2">
            <label className="label">Recipient public key hash (optional)</label>
            <input className="input input-mono" value={recipientKey}
              onChange={(e) => setRecipientKey(e.target.value)}
              placeholder="Leave empty for bearer transfer (anyone can apply)" />
            <span className="text-xs text-muted mt-05" style={{ display: "block" }}>
              {recipientKey ? "Directed transfer — only this wallet can apply it" : "Bearer transfer — anyone with the mRNA file can claim the coins"}
            </span>
          </div>

          {!wallet.privateKeyDNA && (
            <div className="field mt-2">
              <label className="label">Private Key DNA {"\u{1F511}"}</label>
              <div className="flex gap-1 items-center flex-wrap">
                <input className="input input-mono" value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="Paste your private key DNA (TACG characters)" />
                <label className="btn btn-sm btn-secondary" style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                  Load file
                  <input type="file" accept=".txt,.key" onChange={handleKeyFile} style={{ display: "none" }} />
                </label>
              </div>
              <span className="text-xs text-muted mt-05" style={{ display: "block" }}>
                Your private key is required to sign the transfer. It was shown only at wallet creation.
                It is never sent to any server.
              </span>
            </div>
          )}

          <div className="flex gap-1 mt-2">
            <button className="btn btn-primary" onClick={handleCreateTransfer} disabled={sending || !privateKey}>
              {sending ? "Creating mRNA..." : `Create Transfer (${selectedCoins.length} coin${selectedCoins.length > 1 ? "s" : ""})`}
            </button>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card card-glow">
          <div className="text-center mb-2">
            <div style={{ fontSize: "2.5rem" }}>{"\u2705"}</div>
            <h3>Transfer Created!</h3>
            <p className="text-muted text-sm">
              {selectedCoins.length > 1
                ? `${selectedCoins.length} coins bundled into a single mRNA file. Share it with the recipient.`
                : "Share this mRNA payload with the recipient. They can apply it to their wallet to receive the coin."
              }
            </p>
          </div>

          <textarea className="textarea" value={mrnaOutput} readOnly style={{ minHeight: 120 }} />

          <div className="flex gap-1 mt-2 justify-center flex-wrap">
            <button className="btn btn-primary" onClick={handleDownload}>
              Download .mrna File
            </button>
            <button className="btn btn-secondary" onClick={() => {
              navigator.clipboard.writeText(mrnaOutput);
              addToast("info", "mRNA copied to clipboard!");
            }}>
              Copy to Clipboard
            </button>
          </div>

          <div className="text-center mt-3">
            <button className="btn btn-secondary btn-sm" onClick={reset}>Send More Coins</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Receive Flow ─── */

function ReceiveFlow({ wallet, setWallet, addToast }: {
  wallet: { dna: string; publicKeyHash: string };
  setWallet: (w: any) => void;
  addToast: (type: "success" | "error" | "info", msg: string) => void;
}) {
  const [mrnaInput, setMrnaInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<{ valid: boolean; spent: boolean }[] | null>(null);
  const [received, setReceived] = useState(false);
  const [receivedCount, setReceivedCount] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMrnaInput(reader.result as string);
      setValidationResults(null);
      setReceived(false);
    };
    reader.readAsText(file);
  };

  const handleValidate = async () => {
    if (!mrnaInput.trim()) return;
    setValidating(true);
    try {
      const mrnas = parseMRNAData(mrnaInput.trim());
      const results: { valid: boolean; spent: boolean }[] = [];
      for (const mrna of mrnas) {
        try {
          const result = await api.validateTransfer(JSON.stringify(mrna));
          results.push({ valid: result.valid, spent: result.spent });
        } catch {
          results.push({ valid: true, spent: false });
        }
      }
      setValidationResults(results);
      const spentCount = results.filter((r) => r.spent).length;
      const invalidCount = results.filter((r) => !r.valid).length;
      if (spentCount > 0) {
        addToast("error", `${spentCount} of ${mrnas.length} coin${mrnas.length > 1 ? "s" : ""} already spent.`);
      } else if (invalidCount > 0) {
        addToast("error", `${invalidCount} of ${mrnas.length} coin${mrnas.length > 1 ? "s" : ""} invalid.`);
      } else {
        addToast("success", `All ${mrnas.length} coin${mrnas.length > 1 ? "s" : ""} valid! Safe to apply.`);
      }
    } catch (err: any) {
      addToast("error", `Validation error: ${err.message}`);
      setValidationResults(null);
    } finally {
      setValidating(false);
    }
  };

  const handleReceive = () => {
    if (!mrnaInput.trim()) return;
    try {
      const mrnas = parseMRNAData(mrnaInput.trim());
      const newDNA = applyMRNABundle(wallet.dna, mrnas);
      setWallet({ ...wallet, dna: newDNA });
      setReceivedCount(mrnas.length);
      setReceived(true);
      addToast("success", `${mrnas.length} coin${mrnas.length > 1 ? "s" : ""} received!`);
    } catch (err: any) {
      addToast("error", `Receive failed: ${err.message}`);
    }
  };

  if (received) {
    return (
      <div className="card card-glow text-center" style={{ padding: "3rem" }}>
        <div style={{ fontSize: "3rem" }}>{"\u{1F389}"}</div>
        <h3 style={{ marginTop: "1rem" }}>
          {receivedCount} Coin{receivedCount > 1 ? "s" : ""} Received!
        </h3>
        <p className="text-muted text-sm" style={{ maxWidth: 400, margin: "0.75rem auto 1.5rem" }}>
          {receivedCount > 1
            ? `All ${receivedCount} coins have been spliced into your wallet's DNA.`
            : "The coin has been mutated into your wallet's DNA."
          } Check your wallet to see your updated balance.
        </p>
        <div className="flex gap-1 justify-center">
          <Link to="/wallet" className="btn btn-primary">View Wallet</Link>
          <button className="btn btn-secondary" onClick={() => { setReceived(false); setMrnaInput(""); setValidationResults(null); }}>
            Receive More
          </button>
        </div>
      </div>
    );
  }

  const parsedCount = (() => {
    if (!mrnaInput.trim()) return 0;
    try { return parseMRNAData(mrnaInput.trim()).length; } catch { return 0; }
  })();

  return (
    <div className="card">
      <h3>Receive Coins</h3>
      <p className="text-muted text-sm mb-2">
        Upload or paste the mRNA transfer data. Supports both single coins and multi-coin bundles.
      </p>

      <div className="receive-methods">
        <div className="receive-method">
          <label className="label">Upload .mrna file</label>
          <input type="file" accept=".mrna,.json" onChange={handleFileUpload}
            style={{ color: "var(--text-muted)", fontSize: "0.85rem" }} />
        </div>
        <div className="receive-divider"><span>or</span></div>
        <div className="receive-method">
          <label className="label">Paste mRNA data</label>
          <textarea className="textarea" value={mrnaInput}
            onChange={(e) => { setMrnaInput(e.target.value); setValidationResults(null); }}
            placeholder="Paste the transfer mRNA JSON here (single or bundle)..." />
        </div>
      </div>

      {parsedCount > 0 && (
        <div className="bundle-info">
          {"\u{1F4E6}"} Detected <strong>{parsedCount} coin{parsedCount > 1 ? "s" : ""}</strong> in this transfer
          {parsedCount > 1 && " (bundle)"}
        </div>
      )}

      {validationResults && (
        <div className="validation-summary">
          {validationResults.map((r, i) => (
            <div key={i} className={`validation-item ${r.spent ? "spent" : r.valid ? "valid" : "invalid"}`}>
              <span>{r.spent ? "\u274C" : r.valid ? "\u2705" : "\u26A0\uFE0F"}</span>
              <span className="text-xs">
                Coin {i + 1}: {r.spent ? "Already spent" : r.valid ? "Valid" : "Invalid"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 mt-2 flex-wrap">
        <button className="btn btn-primary" onClick={handleReceive} disabled={!mrnaInput.trim()}>
          Apply Transfer{parsedCount > 1 ? ` (${parsedCount} coins)` : ""}
        </button>
        <button className="btn btn-secondary" onClick={handleValidate}
          disabled={!mrnaInput.trim() || validating}>
          {validating ? "Validating..." : "Verify First"}
        </button>
      </div>
    </div>
  );
}

/* ─── Styles ─── */

const transferStyles = `
/* Send coin grid */
.send-coin-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;
}
.send-coin-card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1rem; cursor: pointer; transition: all 0.2s; position: relative;
}
.send-coin-card:hover {
  border-color: var(--primary); box-shadow: 0 0 15px var(--primary-glow);
}
.send-coin-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.send-coin-card.selected {
  border-color: var(--primary); background: rgba(0,229,153,0.05);
  box-shadow: 0 0 20px var(--primary-glow);
}

/* Checkbox */
.coin-check { position: absolute; top: 0.75rem; right: 0.75rem; }
.check-box {
  width: 22px; height: 22px; border-radius: 4px; display: flex;
  align-items: center; justify-content: center; font-size: 0.75rem;
  border: 2px solid var(--border); color: transparent;
  transition: all 0.15s; font-weight: 700;
}
.check-box.checked {
  background: var(--primary); border-color: var(--primary); color: var(--bg);
}

/* Send header */
.send-header {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;
}
.send-header h3 { margin: 0; }
.send-header-actions { display: flex; align-items: center; gap: 0.75rem; }
.selection-count {
  font-size: 0.8rem; color: var(--text-muted); font-variant-numeric: tabular-nums;
}

/* Send footer */
.send-footer {
  display: flex; justify-content: center; margin-top: 1.5rem;
  padding-top: 1.5rem; border-top: 1px solid var(--border);
}

/* Confirm summary */
.confirm-summary {
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1rem;
}
.confirm-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem 0; border-bottom: 1px solid var(--border);
}
.confirm-row:last-child { border-bottom: none; }

/* Receive methods */
.receive-methods { margin-bottom: 1rem; }
.receive-method { margin-bottom: 1rem; }
.receive-divider {
  display: flex; align-items: center; gap: 1rem; margin: 0.5rem 0;
  color: var(--text-dim); font-size: 0.8rem;
}
.receive-divider::before, .receive-divider::after {
  content: ""; flex: 1; height: 1px; background: var(--border);
}

/* Bundle info */
.bundle-info {
  padding: 0.65rem 1rem; border-radius: var(--radius); margin-bottom: 1rem;
  background: rgba(0,229,153,0.06); border: 1px solid rgba(0,229,153,0.15);
  font-size: 0.85rem; color: var(--text);
}

/* Validation results */
.validation-summary {
  display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; margin-bottom: 0.5rem;
}
.validation-item {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.35rem 0.75rem; border-radius: var(--radius); font-size: 0.8rem;
}
.validation-item.valid { background: rgba(63,185,80,0.08); border: 1px solid rgba(63,185,80,0.2); }
.validation-item.spent { background: rgba(248,81,73,0.08); border: 1px solid rgba(248,81,73,0.2); }
.validation-item.invalid { background: rgba(210,153,34,0.08); border: 1px solid rgba(210,153,34,0.2); }

/* Transfer explainer */
.transfer-explainer {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem;
}
.te-step { display: flex; gap: 0.75rem; align-items: flex-start; }
.te-num {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; font-family: var(--mono);
  background: var(--primary-glow); border: 2px solid var(--primary); color: var(--primary);
}
.te-step strong { font-size: 0.85rem; display: block; margin-bottom: 0.15rem; }

@media (max-width: 640px) {
  .send-coin-grid { grid-template-columns: 1fr; }
  .transfer-explainer { grid-template-columns: 1fr; }
  .send-header { flex-direction: column; align-items: flex-start; }
}
`;
