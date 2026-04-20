import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useOutletContext } from "react-router-dom";
import { api, type Listing, formatFileSize } from "../api";
import type { MarketUser } from "../store";

interface OutletCtx {
  user: MarketUser | null;
  networkUrl: string;
}

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, networkUrl } = useOutletContext<OutletCtx>();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [claimingMrnas, setClaimingMrnas] = useState(false);
  const [mrnas, setMrnas] = useState<string[] | null>(null);
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
        description: `File: ${listing.title}`,
      });

      const paymentUrl = `${networkUrl}/pay/${paymentRes.paymentId}`;

      const result = await new Promise<{ success: boolean; paymentId: string }>((resolve) => {
        const width = 480, height = 680;
        const left = Math.floor((screen.width - width) / 2);
        const top = Math.floor((screen.height - height) / 2);
        const popup = window.open(
          paymentUrl, "biocrypt_pay",
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
        );

        if (!popup) {
          resolve({ success: false, paymentId: paymentRes.paymentId });
          return;
        }

        const expectedOrigin = new URL(networkUrl).origin;
        const onMessage = (event: MessageEvent) => {
          if (event.origin !== expectedOrigin) return;
          if (event.data?.type !== "biocrypt-payment") return;
          window.removeEventListener("message", onMessage);
          clearInterval(pollTimer);
          resolve({ success: !!event.data.success, paymentId: event.data.paymentId });
        };

        const pollTimer = setInterval(() => {
          if (popup.closed) {
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

  const handleDownload = useCallback(async () => {
    if (!listing || !user) return;
    setDownloading(true);
    setError("");
    try {
      await api.downloadFile(listing.id, user.publicKeyHash);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }, [listing, user]);

  const handleClaimMrnas = useCallback(async () => {
    if (!listing || !user) return;
    setClaimingMrnas(true);
    setError("");
    try {
      const result = await api.getSellerMrnas(listing.id, user.publicKeyHash);
      setMrnas(result.mrnas);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaimingMrnas(false);
    }
  }, [listing, user]);

  const handleCopyMrnas = () => {
    if (mrnas) {
      navigator.clipboard.writeText(JSON.stringify(mrnas));
    }
  };

  if (loading) return <div className="page"><p className="text-muted">Loading...</p></div>;
  if (!listing) return <div className="page"><p className="text-muted">{error || "Listing not found"}</p></div>;

  const isSeller = user?.publicKeyHash === listing.sellerPublicKeyHash;
  const isBuyer = user?.publicKeyHash === listing.buyerPublicKeyHash;

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <Link to="/" className="text-sm text-muted mb-2" style={{ display: "inline-block" }}>
        &larr; Back to marketplace
      </Link>

      <div className="card">
        <div className="detail-body">
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{listing.title}</h1>
              <p className="text-muted text-sm">
                Listed by <span className="mono">{listing.sellerPublicKeyHash.slice(0, 16)}...</span>
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="detail-price">{listing.price} ZBIO</div>
              {listing.status === "sold" && <span className="listing-sold-badge">SOLD</span>}
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.25rem 0" }} />

          <p style={{ lineHeight: 1.8, color: "var(--text-muted)" }}>{listing.description}</p>

          <div className="file-info-box mt-2">
            <div className="file-info-row">
              <span className="text-muted">File:</span>
              <span className="mono">{listing.fileName}</span>
            </div>
            <div className="file-info-row">
              <span className="text-muted">Size:</span>
              <span>{formatFileSize(listing.fileSize)}</span>
            </div>
            <div className="file-info-row">
              <span className="text-muted">SHA-256:</span>
              <span className="mono text-xs">{listing.fileHash?.slice(0, 32)}...</span>
            </div>
            {listing.downloads > 0 && (
              <div className="file-info-row">
                <span className="text-muted">Downloads:</span>
                <span>{listing.downloads}</span>
              </div>
            )}
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.25rem 0" }} />

          {/* Buyer purchased just now */}
          {purchased && (
            <div className="detail-success">
              <span style={{ fontSize: "1.5rem" }}>&#x2713;</span>
              <div>
                <b>Purchase complete!</b>
                <p className="text-sm text-muted">You can now download the file.</p>
              </div>
            </div>
          )}

          {/* Buyer can download */}
          {(isBuyer || purchased) && listing.status === "sold" && (
            <div className="mt-2">
              <button className="btn btn-primary btn-lg" onClick={handleDownload} disabled={downloading} style={{ width: "100%" }}>
                {downloading ? "Downloading..." : `Download ${listing.fileName}`}
              </button>
            </div>
          )}

          {/* Seller: claim mRNAs */}
          {isSeller && listing.status === "sold" && (
            <div className="mt-2">
              <p className="text-sm" style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                Your file has been sold! Claim your ZBIO:
              </p>
              {mrnas ? (
                <div>
                  <div className="mrna-box">
                    <code className="text-xs">{JSON.stringify(mrnas).slice(0, 200)}...</code>
                  </div>
                  <button className="btn btn-sm btn-secondary mt-1" onClick={handleCopyMrnas}>
                    Copy mRNA Data
                  </button>
                  <p className="text-xs text-muted mt-1">
                    Paste this on{" "}
                    <a href="https://www.biocrypt.net/transfer" target="_blank" rel="noopener">www.biocrypt.net/transfer</a>{" "}
                    to import the coins into your wallet.
                  </p>
                </div>
              ) : (
                <button className="btn btn-primary" onClick={handleClaimMrnas} disabled={claimingMrnas}>
                  {claimingMrnas ? "Loading..." : "Get Payment mRNAs"}
                </button>
              )}
            </div>
          )}

          {/* Active listing: buy button */}
          {listing.status === "active" && !isSeller && user && (
            <div className="mt-2">
              {error && (
                <div style={{
                  color: "var(--danger)", fontSize: "0.85rem",
                  padding: "0.5rem", background: "rgba(248,81,73,0.1)",
                  borderRadius: "var(--radius)", marginBottom: "1rem",
                }}>{error}</div>
              )}
              <button className="btn btn-primary btn-lg" onClick={handleBuy} disabled={buying} style={{ width: "100%" }}>
                {buying ? "Processing..." : `Buy for ${listing.price} ZBIO`}
              </button>
              <p className="text-xs text-muted mt-1" style={{ textAlign: "center" }}>
                Payment processed securely via www.biocrypt.net gateway
              </p>
            </div>
          )}

          {listing.status === "sold" && !isBuyer && !isSeller && !purchased && (
            <p className="text-muted text-sm">This file has already been sold.</p>
          )}

          {listing.status === "active" && isSeller && (
            <p className="text-muted text-sm">This is your listing. Waiting for a buyer.</p>
          )}

          {listing.status === "active" && !user && (
            <p className="text-muted text-sm">
              Connect your wallet to purchase this file.
            </p>
          )}

          {error && !buying && listing.status !== "active" && (
            <div style={{
              color: "var(--danger)", fontSize: "0.85rem",
              padding: "0.5rem", background: "rgba(248,81,73,0.1)",
              borderRadius: "var(--radius)", marginTop: "1rem",
            }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
