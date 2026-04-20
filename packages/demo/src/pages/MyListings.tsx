import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, type Listing, formatFileSize } from "../api";
import type { MarketUser } from "../store";

interface OutletCtx {
  user: MarketUser | null;
}

export function MyListings() {
  const { user } = useOutletContext<OutletCtx>();
  const [listings, setListings] = useState<Listing[]>([]);
  const [purchases, setPurchases] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.getListings("all")
      .then((all) => {
        setListings(all.filter((l) => l.sellerPublicKeyHash === user.publicKeyHash));
        setPurchases(all.filter((l) => l.buyerPublicKeyHash === user.publicKeyHash));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <h2>Connect Your Wallet</h2>
          <p className="text-muted mt-1">Connect to see your files.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1>My Files</h1>
        <Link to="/sell" className="btn btn-primary btn-sm">Sell a File</Link>
      </div>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : (
        <>
          <h2 className="text-sm" style={{ fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Files I'm Selling
          </h2>
          {listings.length === 0 ? (
            <div className="card mb-2" style={{ textAlign: "center", padding: "2rem" }}>
              <p className="text-muted">You haven't listed any files yet.</p>
              <Link to="/sell" className="btn btn-primary mt-1 btn-sm">List Your First File</Link>
            </div>
          ) : (
            <div className="my-list mb-2">
              {listings.map((item) => (
                <Link to={`/item/${item.id}`} key={item.id} className="my-item">
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>{item.title}</h3>
                    <p className="text-xs text-muted">
                      {item.fileName} &middot; {formatFileSize(item.fileSize)} &middot; {item.price} ZBIO
                    </p>
                  </div>
                  <div>
                    <span className={`status-badge status-${item.status}`}>
                      {item.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <h2 className="text-sm" style={{ fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Files I've Purchased
          </h2>
          {purchases.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p className="text-muted">You haven't purchased any files yet.</p>
              <Link to="/" className="btn btn-secondary mt-1 btn-sm">Browse Files</Link>
            </div>
          ) : (
            <div className="my-list">
              {purchases.map((item) => (
                <Link to={`/item/${item.id}`} key={item.id} className="my-item">
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>{item.title}</h3>
                    <p className="text-xs text-muted">
                      {item.fileName} &middot; {formatFileSize(item.fileSize)} &middot; {item.price} ZBIO
                    </p>
                  </div>
                  <div>
                    <span className="status-badge status-purchased">purchased</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
