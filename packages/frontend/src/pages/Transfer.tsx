import { useState } from "react";
import {
  createMRNA, applyMRNA, serializeMRNA, deserializeMRNA, computeNullifier,
  integrateCoinGene,
} from "@zcoin/core";
import { useStore } from "../store";

export function Transfer() {
  const wallet = useStore((s) => s.wallet);
  const coins = useStore((s) => s.coins);
  const setWallet = useStore((s) => s.setWallet);
  const removeCoin = useStore((s) => s.removeCoin);
  const addToast = useStore((s) => s.addToast);

  const [tab, setTab] = useState<"send" | "receive">("send");
  const [selectedCoin, setSelectedCoin] = useState("");
  const [recipientKey, setRecipientKey] = useState("");
  const [mrnaOutput, setMrnaOutput] = useState("");
  const [mrnaInput, setMrnaInput] = useState("");
  const [sending, setSending] = useState(false);

  const signedCoins = coins.filter((c) => c.signed);

  const handleSend = () => {
    if (!wallet || !selectedCoin) return;
    setSending(true);
    try {
      const coin = coins.find((c) => c.serialHash === selectedCoin);
      if (!coin || !coin.signed) {
        addToast("error", "Select a signed coin.");
        return;
      }

      const result = createMRNA(
        wallet.dna,
        wallet.privateKeyDNA,
        coin.serialHash,
        recipientKey || null,
        coin.networkSignature!,
        coin.networkId!,
        { nonce: coin.nonce, hash: coin.hash, difficulty: coin.difficulty },
      );

      setWallet({ ...wallet, dna: result.modifiedSenderDNA });
      removeCoin(coin.serialHash);

      const serialized = serializeMRNA(result.mrna);
      setMrnaOutput(serialized);
      addToast("success", "Transfer mRNA created. Share it with the recipient.");
    } catch (err: any) {
      addToast("error", `Transfer failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleReceive = () => {
    if (!wallet || !mrnaInput.trim()) return;
    try {
      const mrna = deserializeMRNA(mrnaInput.trim());
      const newDNA = applyMRNA(wallet.dna, mrna);
      setWallet({ ...wallet, dna: newDNA });
      setMrnaInput("");
      addToast("success", `Coin received! Serial: ${mrna.coinSerialHash.slice(0, 12)}...`);
    } catch (err: any) {
      addToast("error", `Receive failed: ${err.message}`);
    }
  };

  const handleDownloadMRNA = () => {
    if (!mrnaOutput) return;
    const blob = new Blob([mrnaOutput], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zcoin-transfer-${Date.now()}.mrna`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setMrnaInput(reader.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="page">
      <h1>Transfer Coins</h1>

      {!wallet ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p className="text-muted">Create a wallet first to send or receive coins.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-2">
            <button className={`btn ${tab === "send" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab("send")}>Send</button>
            <button className={`btn ${tab === "receive" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab("receive")}>Receive</button>
          </div>

          {tab === "send" ? (
            <div className="card">
              <h2>Send Coins</h2>
              <div className="field">
                <label className="label">Select coin to send</label>
                <select className="input" value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}>
                  <option value="">-- Select a signed coin --</option>
                  {signedCoins.map((c) => (
                    <option key={c.serialHash} value={c.serialHash}>
                      {c.serialHash.slice(0, 20)}... ({c.networkId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label">Recipient public key hash (optional for offline)</label>
                <input className="input input-mono" value={recipientKey}
                  onChange={(e) => setRecipientKey(e.target.value)}
                  placeholder="Leave empty for bearer transfer" />
              </div>
              <button className="btn btn-primary" onClick={handleSend}
                disabled={!selectedCoin || sending}>
                {sending ? "Creating mRNA..." : "Create Transfer mRNA"}
              </button>

              {mrnaOutput && (
                <div className="mt-3">
                  <label className="label">Transfer mRNA (share with recipient)</label>
                  <textarea className="textarea" value={mrnaOutput} readOnly
                    style={{ minHeight: 120 }} />
                  <div className="flex gap-1 mt-1">
                    <button className="btn btn-sm btn-secondary" onClick={handleDownloadMRNA}>
                      Download .mrna file
                    </button>
                    <button className="btn btn-sm btn-secondary"
                      onClick={() => { navigator.clipboard.writeText(mrnaOutput); addToast("info", "Copied!"); }}>
                      Copy to clipboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <h2>Receive Coins</h2>
              <div className="field">
                <label className="label">Upload .mrna file</label>
                <input type="file" accept=".mrna,.json" onChange={handleFileUpload}
                  style={{ color: "var(--text-muted)", fontSize: "0.85rem" }} />
              </div>
              <div className="field">
                <label className="label">Or paste mRNA data</label>
                <textarea className="textarea" value={mrnaInput}
                  onChange={(e) => setMrnaInput(e.target.value)}
                  placeholder="Paste the transfer mRNA JSON here..." />
              </div>
              <button className="btn btn-primary" onClick={handleReceive}
                disabled={!mrnaInput.trim()}>
                Apply Transfer
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
