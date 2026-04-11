import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Listing } from "../api";

export function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getListings().then(setListings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="home-header">
        <h1>zcoin Marketplace</h1>
        <p className="text-muted">
          Buy and sell items using zcoin. All payments are processed through the{" "}
          <a href="https://zcoin.bio" target="_blank" rel="noopener">zcoin.bio</a> payment gateway.
        </p>
        <div className="home-actions mt-2">
          <Link to="/sell" className="btn btn-primary">List an Item</Link>
        </div>
      </div>

      {loading ? (
        <div className="home-loading">Loading listings...</div>
      ) : listings.length === 0 ? (
        <div className="home-empty">
          <div className="home-empty-icon">&#x1F6D2;</div>
          <h3>No listings yet</h3>
          <p className="text-muted">Be the first to list an item for sale!</p>
          <Link to="/sell" className="btn btn-primary mt-2">Create Listing</Link>
        </div>
      ) : (
        <div className="listings-grid">
          {listings.map((item) => (
            <Link to={`/item/${item.id}`} key={item.id} className="listing-card">
              {item.imageUrl ? (
                <div className="listing-img" style={{ backgroundImage: `url(${item.imageUrl})` }} />
              ) : (
                <div className="listing-img listing-img-placeholder">
                  <span>&#x1F4E6;</span>
                </div>
              )}
              <div className="listing-body">
                <h3 className="listing-title">{item.title}</h3>
                <p className="listing-desc">{item.description.slice(0, 80)}{item.description.length > 80 ? "..." : ""}</p>
                <div className="listing-footer">
                  <span className="listing-price">{item.price} coin{item.price > 1 ? "s" : ""}</span>
                  {item.status === "sold" && <span className="listing-sold-badge">SOLD</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <style>{styles}</style>
    </div>
  );
}

const styles = `
.home-header { text-align: center; margin-bottom: 3rem; padding-top: 1rem; }
.home-header h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
.home-actions { display: flex; gap: 0.5rem; justify-content: center; }
.home-loading { text-align: center; color: var(--text-muted); padding: 4rem 0; }
.home-empty {
  text-align: center; padding: 4rem 2rem;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.home-empty-icon { font-size: 3rem; margin-bottom: 1rem; }

.listings-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}
.listing-card {
  display: block; text-decoration: none; color: var(--text);
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden;
  transition: all 0.2s;
}
.listing-card:hover {
  border-color: var(--primary); transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3); text-decoration: none;
}
.listing-img {
  height: 180px; background-size: cover; background-position: center;
  background-color: var(--bg-surface);
}
.listing-img-placeholder {
  display: flex; align-items: center; justify-content: center;
  font-size: 3rem; opacity: 0.3;
}
.listing-body { padding: 1rem 1.25rem; }
.listing-title { font-size: 1rem; font-weight: 700; margin-bottom: 0.35rem; }
.listing-desc { font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.75rem; }
.listing-footer { display: flex; justify-content: space-between; align-items: center; }
.listing-price {
  font-weight: 700; color: var(--primary);
  font-family: var(--mono); font-size: 0.95rem;
}
.listing-sold-badge {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.05em;
  background: var(--danger); color: #fff; padding: 0.15rem 0.5rem;
  border-radius: 4px;
}
`;
