import { useEffect, useState, useCallback, useMemo } from "react";
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

      const result = await new Promise<{ success: boolean; paymentId: string; error?: string }>((resolve) => {
        const width = 480, height = 680;
        const left = Math.floor((screen.width - width) / 2);
        const top = Math.floor((screen.height - height) / 2);
        const popup = window.open(
          paymentUrl, "biocrypt_pay",
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
        );

        if (!popup) {
          resolve({ success: false, paymentId: paymentRes.paymentId, error: "Popup blocked by browser" });
          return;
        }

        const expectedOrigin = new URL(networkUrl).origin;
        let settled = false;
        let popupReady = false;
        const openedAt = Date.now();

        // Cross-Origin-Opener-Policy can sever the opener's reference to
        // the popup as soon as it navigates, making `popup.closed` read
        // `true` from us even though the popup window is alive and well.
        // We only treat `popup.closed` as a real cancellation AFTER the
        // popup has explicitly told us it loaded (`biocrypt-payment-ready`)
        // or at least 15 seconds have elapsed since open.
        const onMessage = (event: MessageEvent) => {
          if (event.origin !== expectedOrigin) return;
          if (event.data?.type === "biocrypt-payment-ready") {
            popupReady = true;
            return;
          }
          if (event.data?.type !== "biocrypt-payment") return;
          if (settled) return;
          settled = true;
          window.removeEventListener("message", onMessage);
          clearInterval(pollTimer);
          resolve({
            success: !!event.data.success,
            paymentId: event.data.paymentId || paymentRes.paymentId,
            error: event.data.error,
          });
        };

        const pollTimer = setInterval(() => {
          if (settled) return;
          const grace = popupReady ? 300 : 15000;
          if (Date.now() - openedAt < grace) return;
          let closed = false;
          try { closed = popup.closed; } catch { closed = false; }
          if (closed) {
            settled = true;
            window.removeEventListener("message", onMessage);
            clearInterval(pollTimer);
            resolve({
              success: false,
              paymentId: paymentRes.paymentId,
              error: popupReady ? "Payment popup was closed before completion" : undefined,
            });
          }
        }, 500);

        window.addEventListener("message", onMessage);
      });

      if (!result.success) {
        setError(result.error || "Payment was cancelled.");
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

  // Build the string the seller pastes into www.biocrypt.net/transfer.
  // The Transfer page's `parseMRNAData` expects either a single mRNA
  // payload or a `{type:"bundle", mrnas:[...]}` envelope, NOT a raw
  // JSON array of serialized mRNAs (which is what we used to hand
  // back). We parse each serialized mRNA and wrap them in a proper
  // bundle so Receive accepts the paste in one click.
  const claimPayload = useMemo(() => {
    if (!mrnas || mrnas.length === 0) return "";
    try {
      const parsed = mrnas.map((m) => JSON.parse(m));
      return JSON.stringify({
        type: "bundle",
        mrnas: parsed,
        createdAt: Date.now(),
      });
    } catch {
      // Fallback: the API unexpectedly returned objects instead of
      // JSON strings — emit as-is so the user can at least recover
      // the data.
      return JSON.stringify(mrnas);
    }
  }, [mrnas]);

  const handleCopyMrnas = () => {
    if (claimPayload) navigator.clipboard.writeText(claimPayload);
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
              <p className="text-xs text-muted" style={{ marginTop: "-0.25rem", marginBottom: "0.75rem" }}>
                Your payment is delivered automatically to your wallet via the tracker.{" "}
                Check <a href="https://www.biocrypt.net/wallet" target="_blank" rel="noopener">www.biocrypt.net/wallet</a> — the coins should appear within a few seconds.
                Use the manual claim below only if your wallet was offline during the sale.
              </p>
              {mrnas ? (
                <div>
                  <div className="mrna-box">
                    <code className="text-xs">{claimPayload.slice(0, 200)}{claimPayload.length > 200 ? "..." : ""}</code>
                  </div>
                  <button className="btn btn-sm btn-secondary mt-1" onClick={handleCopyMrnas}>
                    Copy mRNA Data
                  </button>
                  <p className="text-xs text-muted mt-1">
                    Paste this on{" "}
                    <a href="https://www.biocrypt.net/transfer" target="_blank" rel="noopener">www.biocrypt.net/transfer</a>{" "}
                    (Receive tab) to import the coins manually.
                  </p>
                </div>
              ) : (
                <button className="btn btn-sm btn-secondary" onClick={handleClaimMrnas} disabled={claimingMrnas}>
                  {claimingMrnas ? "Loading..." : "Manual claim (if needed)"}
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
