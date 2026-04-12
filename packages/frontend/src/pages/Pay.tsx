import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { createMRNA, serializeMRNA } from "@zcoin/core";
import { useStore } from "../store";

interface PaymentInfo {
  paymentId: string;
  status: string;
  amount: number;
  description: string;
  recipientPublicKeyHash: string;
  metadata: Record<string, string>;
  expiresAt: number;
}

export function Pay() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const wallet = useStore((s) => s.wallet);
  const coins = useStore((s) => s.coins);
  const setWallet = useStore((s) => s.setWallet);
  const removeCoin = useStore((s) => s.removeCoin);

  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [privateKey, setPrivateKey] = useState(wallet?.privateKeyDNA || "");

  const signedCoins = coins.filter((c) => c.signed);
  const isPopup = !!window.opener;

  useEffect(() => {
    if (!paymentId) return;
    fetch(`/api/gateway/payments/${paymentId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Payment not found");
        return r.json();
      })
      .then((data) => {
        setPayment(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [paymentId]);

  const toggleCoin = useCallback(
    (serialHash: string) => {
      setSelectedCoins((prev) => {
        if (prev.includes(serialHash)) return prev.filter((s) => s !== serialHash);
        if (payment && prev.length >= payment.amount) return prev;
        return [...prev, serialHash];
      });
    },
    [payment],
  );

  const handlePay = useCallback(async () => {
    if (!wallet || !payment || selectedCoins.length < payment.amount) return;
    setProcessing(true);
    setError("");

    try {
      const mrnas: string[] = [];
      let currentDna = wallet.dna;

      for (const serialHash of selectedCoins) {
        const coin = coins.find((c) => c.serialHash === serialHash);
        if (!coin || !coin.signed) throw new Error("Invalid coin selected");

        const result = createMRNA(
          currentDna,
          privateKey,
          coin.serialHash,
          payment.recipientPublicKeyHash,
          coin.networkSignature!,
          coin.networkId!,
          coin.networkGenome || wallet.networkGenome || "",
          { nonce: coin.nonce, hash: coin.hash, difficulty: coin.difficulty },
          [],
          coin.rflpFingerprint,
        );

        currentDna = result.modifiedSenderDNA;
        mrnas.push(serializeMRNA(result.mrna));
      }

      const res = await fetch(`/api/gateway/payments/${payment.paymentId}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mrnas }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Payment failed" }));
        throw new Error(body.message || "Payment failed");
      }

      setWallet({ ...wallet, dna: currentDna });
      for (const serialHash of selectedCoins) {
        removeCoin(serialHash);
      }

      setDone(true);

      if (window.opener) {
        window.opener.postMessage(
          {
            type: "zcoin-payment",
            success: true,
            paymentId: payment.paymentId,
            txCount: mrnas.length,
          },
          "*",
        );
        setTimeout(() => window.close(), 2000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  }, [wallet, payment, selectedCoins, coins, setWallet, removeCoin]);

  const handleCancel = () => {
    if (window.opener) {
      window.opener.postMessage(
        { type: "zcoin-payment", success: false, paymentId: paymentId || "", error: "cancelled" },
        "*",
      );
      window.close();
    }
  };

  if (loading) {
    return (
      <div className="pay-page">
        <div className="pay-card">
          <div className="pay-loading">Loading payment details...</div>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  if (!payment || payment.status === "expired") {
    return (
      <div className="pay-page">
        <div className="pay-card">
          <div className="pay-icon pay-icon-error">!</div>
          <h2>{payment?.status === "expired" ? "Payment Expired" : "Payment Not Found"}</h2>
          <p className="text-muted">{error || "This payment link is invalid or has expired."}</p>
          {isPopup && <button className="btn btn-secondary" onClick={() => window.close()}>Close</button>}
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  if (payment.status === "fulfilled" || done) {
    return (
      <div className="pay-page">
        <div className="pay-card">
          <div className="pay-icon pay-icon-success">&#x2713;</div>
          <h2>Payment Complete</h2>
          <p className="text-muted">
            {payment.amount} coin{payment.amount > 1 ? "s" : ""} sent for "{payment.description}"
          </p>
          {isPopup ? (
            <p className="text-xs text-muted mt-2">This window will close automatically...</p>
          ) : (
            <Link to="/wallet" className="btn btn-primary mt-2">Back to Wallet</Link>
          )}
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="pay-page">
        <div className="pay-card">
          <div className="pay-header">
            <div className="pay-brand">&#x29D6; zBioCoin</div>
            <div className="pay-label">Payment Request</div>
          </div>
          <div className="pay-amount">{payment.amount} coin{payment.amount > 1 ? "s" : ""}</div>
          <p className="pay-desc">{payment.description}</p>
          <hr className="pay-divider" />
          <p className="text-muted" style={{ textAlign: "center" }}>
            You need a zBioCoin wallet to make this payment.
          </p>
          <div className="pay-actions">
            <Link to="/wallet" className="btn btn-primary">Create Wallet</Link>
            {isPopup && <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>}
          </div>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((payment.expiresAt - Date.now()) / 1000)));
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(Math.max(0, Math.floor((payment.expiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [payment.expiresAt]);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="pay-page">
      <div className="pay-card">
        <div className="pay-header">
          <div className="pay-brand">&#x29D6; zBioCoin</div>
          <div className="pay-label">Payment Request</div>
        </div>

        <div className="pay-amount">{payment.amount} coin{payment.amount > 1 ? "s" : ""}</div>
        <p className="pay-desc">{payment.description}</p>

        <div className="pay-meta">
          <span>To: <span className="mono">{payment.recipientPublicKeyHash.slice(0, 16)}...</span></span>
          <span>Expires: {minutes}:{seconds.toString().padStart(2, "0")}</span>
        </div>

        <hr className="pay-divider" />

        <div className="pay-wallet-info">
          <span>Your wallet: <span className="mono">{wallet.publicKeyHash.slice(0, 12)}...</span></span>
          <span>{signedCoins.length} coin{signedCoins.length !== 1 ? "s" : ""} available</span>
        </div>

        {signedCoins.length < payment.amount ? (
          <div className="pay-insufficient">
            Not enough signed coins. You need {payment.amount} but have {signedCoins.length}.
            <Link to="/mine" className="btn btn-sm btn-secondary mt-1">Mine More Coins</Link>
          </div>
        ) : (
          <>
            <div className="pay-coin-label">
              Select {payment.amount} coin{payment.amount > 1 ? "s" : ""} to send:
            </div>
            <div className="pay-coin-list">
              {signedCoins.map((c) => (
                <div
                  key={c.serialHash}
                  className={`pay-coin ${selectedCoins.includes(c.serialHash) ? "pay-coin-selected" : ""}`}
                  onClick={() => toggleCoin(c.serialHash)}
                >
                  <div className="pay-coin-check">
                    {selectedCoins.includes(c.serialHash) ? "\u2713" : ""}
                  </div>
                  <div className="pay-coin-info">
                    <div className="mono text-xs">{c.serialHash.slice(0, 24)}...</div>
                    <div className="text-xs text-muted">{c.networkId}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!wallet.privateKeyDNA && (
          <div className="field mt-2">
            <label className="label">{"\u{1F511}"} Private Key DNA</label>
            <input className="input input-mono" value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="Paste your private key DNA" />
            <span className="text-xs text-muted" style={{ display: "block", marginTop: "0.25rem" }}>
              Required to sign the payment. Never sent to any server.
            </span>
          </div>
        )}

        {error && <div className="pay-error">{error}</div>}

        <div className="pay-actions">
          <button
            className="btn btn-primary btn-lg"
            disabled={selectedCoins.length < payment.amount || processing || !privateKey}
            onClick={handlePay}
          >
            {processing ? "Processing..." : `Pay ${payment.amount} Coin${payment.amount > 1 ? "s" : ""}`}
          </button>
          {isPopup && (
            <button className="btn btn-secondary" onClick={handleCancel} disabled={processing}>
              Cancel
            </button>
          )}
        </div>
      </div>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
.pay-page {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  padding: 2rem 1rem;
  background: radial-gradient(ellipse at 50% 20%, rgba(0,229,153,0.06) 0%, transparent 60%);
}
.pay-card {
  width: 100%; max-width: 440px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 16px; padding: 2rem; box-shadow: 0 16px 48px rgba(0,0,0,0.4);
}
.pay-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.5rem;
}
.pay-brand { font-weight: 800; font-size: 1.1rem; }
.pay-label {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--primary);
  background: var(--primary-glow); padding: 0.25rem 0.7rem; border-radius: 999px;
}
.pay-amount {
  font-size: 2.5rem; font-weight: 800; text-align: center;
  color: var(--primary); margin-bottom: 0.25rem;
}
.pay-desc {
  text-align: center; color: var(--text-muted); font-size: 0.95rem;
  margin-bottom: 1rem;
}
.pay-meta {
  display: flex; justify-content: space-between;
  font-size: 0.75rem; color: var(--text-dim);
  margin-bottom: 0.5rem;
}
.pay-divider {
  border: none; border-top: 1px solid var(--border); margin: 1rem 0;
}
.pay-wallet-info {
  display: flex; justify-content: space-between;
  font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;
}
.pay-coin-label {
  font-size: 0.82rem; font-weight: 600; margin-bottom: 0.5rem;
}
.pay-coin-list {
  max-height: 200px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 0.35rem;
  margin-bottom: 1rem;
}
.pay-coin {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 0.75rem; border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer; transition: all 0.15s;
}
.pay-coin:hover { border-color: var(--border-bright); }
.pay-coin-selected { border-color: var(--primary); background: var(--primary-glow); }
.pay-coin-check {
  width: 22px; height: 22px; border-radius: 4px;
  border: 2px solid var(--border); display: flex;
  align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; color: var(--primary);
  flex-shrink: 0;
}
.pay-coin-selected .pay-coin-check { border-color: var(--primary); background: var(--primary-glow); }
.pay-coin-info { min-width: 0; }
.pay-insufficient {
  text-align: center; color: var(--danger, #f85149);
  font-size: 0.88rem; padding: 1rem; margin-bottom: 1rem;
}
.pay-error {
  color: var(--danger, #f85149); font-size: 0.85rem;
  padding: 0.6rem; border-radius: var(--radius);
  background: rgba(248,81,73,0.1); margin-bottom: 1rem;
  text-align: center;
}
.pay-actions {
  display: flex; flex-direction: column; gap: 0.5rem;
}
.pay-loading { text-align: center; color: var(--text-muted); padding: 3rem 0; }
.pay-icon {
  width: 64px; height: 64px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; font-weight: 800; margin: 0 auto 1rem;
}
.pay-icon-success { background: rgba(0,229,153,0.15); color: var(--primary); }
.pay-icon-error { background: rgba(248,81,73,0.15); color: #f85149; }
`;
