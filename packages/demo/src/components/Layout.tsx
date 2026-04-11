import { NavLink, Outlet } from "react-router-dom";
import { useUser } from "../store";

const ZCOIN_NETWORK = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://zcoin.bio";

export function Layout() {
  const { user, setUser } = useUser();

  const handleConnect = () => {
    const pkh = prompt("Enter your zcoin public key hash (from your wallet on zcoin.bio):");
    if (pkh && pkh.length >= 10) {
      setUser({ publicKeyHash: pkh, connectedAt: Date.now() });
    }
  };

  return (
    <>
      <nav className="demo-nav">
        <div className="demo-nav-inner">
          <NavLink to="/" className="demo-brand">
            <span className="demo-brand-icon">&#x29D6;</span>
            <span>zcoin <b>Marketplace</b></span>
            <span className="demo-badge">DEMO</span>
          </NavLink>
          <div className="demo-nav-links">
            <NavLink to="/" className={navCls}>Browse</NavLink>
            <NavLink to="/sell" className={navCls}>Sell</NavLink>
            <NavLink to="/my" className={navCls}>My Listings</NavLink>
          </div>
          <div className="demo-nav-right">
            {user ? (
              <div className="demo-user">
                <span className="demo-user-dot" />
                <span className="mono text-xs">{user.publicKeyHash.slice(0, 10)}...</span>
                <button className="btn btn-sm btn-secondary" onClick={() => setUser(null)}>Disconnect</button>
              </div>
            ) : (
              <button className="btn btn-sm btn-primary" onClick={handleConnect}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </nav>
      <Outlet context={{ user, setUser, networkUrl: ZCOIN_NETWORK }} />
      <footer className="demo-footer">
        <div className="container">
          <p>
            This is a demo marketplace powered by{" "}
            <a href={ZCOIN_NETWORK} target="_blank" rel="noopener">zcoin.bio</a>{" "}
            payment gateway. All transactions use real zcoin network coins.
          </p>
          <p className="text-xs text-muted mt-1">
            Integrate zcoin payments in your own app:{" "}
            <code>&lt;script src="{ZCOIN_NETWORK}/gateway/zcoin-pay.js"&gt;</code>
          </p>
        </div>
      </footer>
      <style>{styles}</style>
    </>
  );
}

function navCls({ isActive }: { isActive: boolean }) {
  return `nav-link${isActive ? " nav-link-active" : ""}`;
}

const styles = `
.demo-nav {
  position: sticky; top: 0; z-index: 100;
  background: rgba(6,9,15,0.9); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.demo-nav-inner {
  max-width: 1140px; margin: 0 auto; padding: 0 1.5rem;
  height: 60px; display: flex; align-items: center; gap: 1.5rem;
}
.demo-brand {
  display: flex; align-items: center; gap: 0.4rem;
  font-size: 0.95rem; color: var(--text); text-decoration: none;
  white-space: nowrap;
}
.demo-brand:hover { text-decoration: none; }
.demo-brand-icon { color: var(--primary); font-size: 1.2rem; }
.demo-badge {
  font-size: 0.55rem; font-weight: 800; letter-spacing: 0.1em;
  background: var(--secondary); color: #000; padding: 0.1rem 0.4rem;
  border-radius: 4px; margin-left: 0.3rem;
}
.demo-nav-links { display: flex; gap: 0.25rem; flex: 1; }
.nav-link {
  padding: 0.4rem 0.8rem; border-radius: var(--radius);
  font-size: 0.82rem; font-weight: 500; color: var(--text-muted);
  text-decoration: none; transition: all 0.15s;
}
.nav-link:hover { color: var(--text); background: var(--bg-card); text-decoration: none; }
.nav-link-active { color: var(--primary); background: var(--primary-glow); }
.demo-nav-right { display: flex; align-items: center; gap: 0.5rem; }
.demo-user { display: flex; align-items: center; gap: 0.5rem; }
.demo-user-dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--success);
}
.demo-footer {
  border-top: 1px solid var(--border); padding: 2rem 0;
  text-align: center; font-size: 0.85rem; color: var(--text-muted);
  margin-top: 4rem;
}
.demo-footer code {
  background: var(--bg-surface); padding: 0.15rem 0.4rem;
  border-radius: 4px; font-size: 0.75rem;
}
@media (max-width: 640px) {
  .demo-nav-inner { gap: 0.5rem; }
  .demo-brand span:not(.demo-brand-icon) { display: none; }
  .nav-link { padding: 0.35rem 0.5rem; font-size: 0.75rem; }
}
`;
