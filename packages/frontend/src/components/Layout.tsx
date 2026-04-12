import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useStore } from "../store";

const PAGE_TITLES: Record<string, string> = {
  "/": "zBioCoin — DNA-Based Cryptocurrency",
  "/wallet": "Wallet — zBioCoin",
  "/mine": "Mine Coins — zBioCoin",
  "/transfer": "Transfer — zBioCoin",
  "/network": "Network Explorer — zBioCoin",
  "/economics": "Economics — zBioCoin",
  "/proof": "Cryptographic Proof — zBioCoin",
  "/how-it-works": "How It Works — zBioCoin",
};

export function Layout() {
  const location = useLocation();
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);
  const wallet = useStore((s) => s.wallet);
  const coins = useStore((s) => s.coins);
  const mining = useStore((s) => s.mining);
  const [menuOpen, setMenuOpen] = useState(false);

  const signedCount = coins.filter((c) => c.signed).length;

  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || "zBioCoin";
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <NavLink to="/" className="navbar-brand">
            <span className="brand-icon">&#x29D6;</span>
            <span className="brand-text">zcoin<span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>.bio</span></span>
          </NavLink>

          {/* Desktop nav */}
          <div className="navbar-links navbar-desktop">
            <NavLink to="/wallet" className={navCls}>
              Wallet
              {wallet && <span className="nav-badge">{signedCount}</span>}
            </NavLink>
            <NavLink to="/mine" className={navCls}>
              Mine
              {mining.active && <span className="nav-pulse" />}
            </NavLink>
            <NavLink to="/transfer" className={navCls}>Transfer</NavLink>
            <NavLink to="/network" className={navCls}>Network</NavLink>
            <NavLink to="/economics" className={navCls}>Economics</NavLink>
            <NavLink to="/proof" className={navCls}>Proof</NavLink>
            <NavLink to="/how-it-works" className={navCls}>How It Works</NavLink>
          </div>

          {/* Wallet pill (desktop) */}
          {wallet && (
            <NavLink to="/wallet" className="wallet-pill wallet-pill-desktop">
              <span className="pill-coins">{signedCount}</span>
              <span className="pill-label">coins</span>
            </NavLink>
          )}

          {/* Mobile hamburger */}
          <button
            className={`hamburger ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
          >
            <span /><span /><span />
          </button>
        </div>

        {/* Mobile drawer */}
        <div className={`mobile-drawer ${menuOpen ? "open" : ""}`}>
          {wallet && (
            <div className="drawer-wallet">
              <div className="pill-coins" style={{ fontSize: "1.5rem" }}>{signedCount}</div>
              <div className="text-muted text-xs">signed coins</div>
              <div className="mono text-xs" style={{ marginTop: "0.25rem", opacity: 0.6 }}>
                {wallet.publicKeyHash.slice(0, 16)}...
              </div>
            </div>
          )}
          <NavLink to="/wallet" className={navCls} onClick={() => setMenuOpen(false)}>
            <span className="drawer-icon">{"\u{1F4B3}"}</span> Wallet
          </NavLink>
          <NavLink to="/mine" className={navCls} onClick={() => setMenuOpen(false)}>
            <span className="drawer-icon">{"\u26CF\uFE0F"}</span> Mine
            {mining.active && <span className="nav-badge" style={{ marginLeft: "auto" }}>Active</span>}
          </NavLink>
          <NavLink to="/transfer" className={navCls} onClick={() => setMenuOpen(false)}>
            <span className="drawer-icon">{"\u{1F4E8}"}</span> Transfer
          </NavLink>
          <NavLink to="/network" className={navCls} onClick={() => setMenuOpen(false)}>
            <span className="drawer-icon">{"\u{1F30D}"}</span> Network
          </NavLink>
          <NavLink to="/economics" className={navCls} onClick={() => setMenuOpen(false)}>
            <span className="drawer-icon">{"\u{1F4C8}"}</span> Economics
          </NavLink>
          <NavLink to="/proof" className={navCls} onClick={() => setMenuOpen(false)}>
            <span className="drawer-icon">{"\u{1F512}"}</span> Proof
          </NavLink>
          <NavLink to="/how-it-works" className={navCls} onClick={() => setMenuOpen(false)}>
            <span className="drawer-icon">{"\u{1F9EC}"}</span> How It Works
          </NavLink>
        </div>
      </nav>

      {menuOpen && <div className="drawer-overlay" onClick={() => setMenuOpen(false)} />}

      <Outlet />

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`} onClick={() => removeToast(t.id)}>
              {t.message}
            </div>
          ))}
        </div>
      )}
      <style>{navStyles}</style>
    </>
  );
}

function navCls({ isActive }: { isActive: boolean }) {
  return `nav-link${isActive ? " nav-link-active" : ""}`;
}

const navStyles = `
.navbar {
  position: sticky; top: 0; z-index: 100;
  background: rgba(6, 9, 15, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.navbar-inner {
  max-width: 1140px; margin: 0 auto;
  padding: 0 1.5rem;
  height: 60px;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
}
.navbar-brand {
  display: flex; align-items: center; gap: 0.5rem;
  font-weight: 800; font-size: 1.15rem; color: var(--text);
  text-decoration: none;
}
.brand-icon { color: var(--primary); font-size: 1.3rem; }
.brand-dim { color: var(--text-muted); font-weight: 500; }
.navbar-links { display: flex; gap: 0.25rem; flex: 1; justify-content: center; }
.nav-link {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 0.9rem; border-radius: var(--radius);
  font-size: 0.85rem; font-weight: 500; color: var(--text-muted);
  text-decoration: none; transition: all 0.15s;
}
.nav-link:hover { color: var(--text); background: var(--bg-card); text-decoration: none; }
.nav-link-active { color: var(--primary); background: var(--primary-glow); }
.nav-badge {
  font-size: 0.65rem; font-weight: 700; background: var(--primary);
  color: var(--bg); padding: 0.1rem 0.4rem; border-radius: 999px;
  min-width: 18px; text-align: center; line-height: 1.3;
}
.nav-pulse {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary);
  animation: navPulse 1.5s ease-in-out infinite;
}
@keyframes navPulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 var(--primary-glow); }
  50% { opacity: 0.6; box-shadow: 0 0 8px 4px var(--primary-glow); }
}

/* Wallet pill */
.wallet-pill {
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.35rem 0.8rem; border-radius: 999px;
  background: var(--primary-glow); border: 1px solid rgba(0,229,153,0.25);
  text-decoration: none; transition: all 0.15s;
}
.wallet-pill:hover { border-color: var(--primary); text-decoration: none; box-shadow: 0 0 12px var(--primary-glow); }
.pill-coins { font-family: var(--mono); font-weight: 700; color: var(--primary); font-size: 0.9rem; }
.pill-label { font-size: 0.7rem; color: var(--text-muted); }

/* Hamburger */
.hamburger {
  display: none; background: none; border: none; cursor: pointer;
  padding: 0.5rem; flex-direction: column; gap: 5px;
}
.hamburger span {
  display: block; width: 22px; height: 2px; background: var(--text);
  border-radius: 2px; transition: all 0.25s;
}
.hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
.hamburger.open span:nth-child(2) { opacity: 0; }
.hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }

/* Mobile drawer */
.mobile-drawer {
  display: none; flex-direction: column;
  background: var(--bg-card); border-top: 1px solid var(--border);
  overflow: hidden; max-height: 0; transition: max-height 0.3s ease;
}
.mobile-drawer.open { max-height: 400px; }
.mobile-drawer .nav-link {
  padding: 0.85rem 1.5rem; font-size: 1rem; border-radius: 0;
  border-bottom: 1px solid var(--border);
}
.drawer-icon { font-size: 1.1rem; }
.drawer-wallet {
  padding: 1.25rem 1.5rem; text-align: center;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(0,229,153,0.05), transparent);
}
.drawer-overlay {
  display: none; position: fixed; inset: 0; z-index: 99;
  background: rgba(0,0,0,0.5); animation: fadeIn 0.2s;
}

@media (max-width: 768px) {
  .navbar-desktop, .wallet-pill-desktop { display: none !important; }
  .hamburger { display: flex; }
  .mobile-drawer { display: flex; }
  .drawer-overlay { display: block; }
  .navbar-brand { font-size: 1rem; }
}
@media (min-width: 769px) {
  .mobile-drawer, .hamburger, .drawer-overlay { display: none !important; }
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;
