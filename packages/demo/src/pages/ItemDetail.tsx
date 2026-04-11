import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useOutletContext } from "react-router-dom";
import { api, type Listing } from "../api";
import type { DemoUser } from "../store";

interface OutletCtx {
  user: DemoUser | null;
  networkUrl: string;
}

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, networkUrl } = useOutletContext<OutletCtx>();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getListing(id).then(setListing).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  const handleBuy = useCallback(async () => {
    if (!listing || !user) return;
    setBuying(true);
    setError("");

    try {
      const paymentRes = await api.createPayment({
        amount: listing.price,
        recipientPublicKeyHash: listing.sellerPublicKeyHash,
        description: `Marketplace: ${listing.title}`,
      });

      const paymentUrl = `${networkUrl}/pay/${paymentRes.paymentId}`;

      const result = await new Promise<{ success: boolean; paymentId: string }>((resolve) => {
        const width = 480;
        const height = 680;
        const left = Math.floor((screen.width - width) / 2);
        const top = Math.floor((screen.height - height) / 2);
        const popup = window.open(
          paymentUrl,
          "zcoin_pay",
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
        );

        const onMessage = (event: MessageEvent) => {
          if (event.data?.type !== "zcoin-payment") return;
          window.removeEventListener("message", onMessage);
          clearInterval(pollTimer);
          resolve({ success: !!event.data.success, paymentId: event.data.paymentId });
        };

        const pollTimer = setInterval(() => {
          if (popup && popup.closed) {
            window.removeEventListener("message", onMessage);
            clearInterval(pollTimer);
            resolve({ success: false, paymentId: paymentRes.paymentId });
          }
        }, 500);

        window.addEventListener("message", onMessage);
      });

      if (!result.success) {
        setError("Payment was cancelled or failed.");
        setBuying(false);
        return;
      }

      await api.purchaseListing(listing.id, result.paymentId, user.publicKeyHash);
      setPurchased(true);
      setListing({ ...listing, status: "sold", buyerPublicKeyHash: user.publicKeyHash });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuying(false);
    }
  }, [listing, user, networkUrl]);

  if (loading) return <div className="page"><p className="text-muted">Loading...</p></div>;
  if (!listing) return <div className="page"><p className="text-muted">{error || "Listing not found"}</p></div>;

  const isSeller = user?.publicKeyHash === listing.sellerPublicKeyHash;

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <Link to="/" className="text-sm text-muted mb-2" style={{ display: "inline-block" }}>
        &larr; Back to marketplace
      </Link>

      <div className="card">
        {listing.imageUrl && (
          <div className="detail-img" style={{ backgroundImage: `url(${listing.imageUrl})` }} />
        )}

        <div className="detail-body">
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{listing.title}</h1>
              <p className="text-muted text-sm">
                Listed by <span className="mono">{listing.sellerPublicKeyHash.slice(0, 16)}...</span>
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="detail-price">{listing.price} coin{listing.price > 1 ? "s" : ""}</div>
              {listing.status === "sold" && <span className="listing-sold-badge">SOLD</span>}
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.25rem 0" }} />

          <p style={{ lineHeight: 1.8, color: "var(--text-muted)" }}>{listing.description}</p>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.25rem 0" }} />

          {purchased ? (
            <div className="detail-success">
              <span style={{ fontSize: "1.5rem" }}>&#x2713;</span>
              <div>
                <b>Purchase complete!</b>
                <p className="text-sm text-muted">The coins have been transferred to the seller.</p>
              </div>
            </div>
          ) : listing.status === "sold" ? (
            <p className="text-muted text-sm">This item has already been sold.</p>
          ) : !user ? (
            <p className="text-muted text-sm">
              Connect your wallet to purchase this item.
            </p>
          ) : isSeller ? (
            <p className="text-muted text-sm">This is your listing.</p>
          ) : (
            <div>
              {error && (
                <div style={{
                  color: "var(--danger)", fontSize: "0.85rem",
                  padding: "0.5rem", background: "rgba(248,81,73,0.1)",
                  borderRadius: "var(--radius)", marginBottom: "1rem",
                }}>{error}</div>
              )}
              <button className="btn btn-primary btn-lg" onClick={handleBuy} disabled={buying}>
                {buying ? "Processing..." : `Buy for ${listing.price} Coin${listing.price > 1 ? "s" : ""}`}
              </button>
              <p className="text-xs text-muted mt-1">
                Payment processed securely via zcoin.bio gateway
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-2">
        <h3 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          How this works
        </h3>
        <ol style={{ paddingLeft: "1.25rem", fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 2 }}>
          <li>Click "Buy" to open the zcoin.bio payment popup</li>
          <li>Select coins from your wallet to pay</li>
          <li>Approve the transfer (mRNA is created cryptographically)</li>
          <li>The gateway validates your payment and marks the item as sold</li>
          <li>Seller can download the mRNA to receive coins in their wallet</li>
        </ol>
      </div>

      <style>{detailStyles}</style>
    </div>
  );
}

const detailStyles = `
.detail-img {
  height: 300px; background-size: cover; background-position: center;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  margin: -1.5rem -1.5rem 1.5rem;
}
.detail-body { }
.detail-price {
  font-size: 1.5rem; font-weight: 800; color: var(--primary);
  font-family: var(--mono);
}
.detail-success {
  display: flex; align-items: center; gap: 1rem;
  padding: 1rem; background: rgba(0,229,153,0.08);
  border-radius: var(--radius); color: var(--primary);
}
.listing-sold-badge {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.05em;
  background: var(--danger); color: #fff; padding: 0.15rem 0.5rem;
  border-radius: 4px; display: inline-block; margin-top: 0.25rem;
}
`;
