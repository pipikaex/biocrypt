import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, type Listing } from "../api";
import type { DemoUser } from "../store";

interface OutletCtx {
  user: DemoUser | null;
}

export function MyListings() {
  const { user } = useOutletContext<OutletCtx>();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.getListings("all")
      .then((all) => all.filter((l) => l.sellerPublicKeyHash === user.publicKeyHash))
      .then(setListings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <h2>Connect Your Wallet</h2>
          <p className="text-muted mt-1">Connect to see your listings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1>My Listings</h1>
        <Link to="/sell" className="btn btn-primary btn-sm">New Listing</Link>
      </div>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : listings.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p className="text-muted">You haven't listed anything yet.</p>
          <Link to="/sell" className="btn btn-primary mt-2">Create Your First Listing</Link>
        </div>
      ) : (
        <div className="my-list">
          {listings.map((item) => (
            <Link to={`/item/${item.id}`} key={item.id} className="my-item">
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>{item.title}</h3>
                <p className="text-xs text-muted">
                  {new Date(item.createdAt).toLocaleDateString()} &middot;{" "}
                  {item.price} coin{item.price > 1 ? "s" : ""}
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
      <style>{myStyles}</style>
    </div>
  );
}

const myStyles = `
.my-list { display: flex; flex-direction: column; gap: 0.5rem; }
.my-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 1.25rem; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius);
  text-decoration: none; color: var(--text); transition: border-color 0.15s;
}
.my-item:hover { border-color: var(--border-bright); text-decoration: none; }
.status-badge {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em;
  text-transform: uppercase; padding: 0.2rem 0.6rem; border-radius: 4px;
}
.status-active { background: rgba(0,229,153,0.15); color: var(--primary); }
.status-sold { background: rgba(248,81,73,0.15); color: var(--danger); }
.status-cancelled { background: rgba(100,116,139,0.15); color: var(--text-dim); }
`;
