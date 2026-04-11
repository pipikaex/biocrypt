import { NavLink, Outlet } from "react-router-dom";
import { useStore } from "../store";

export function Layout() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <NavLink to="/" className="navbar-brand">
            <span className="brand-icon">&#x29D6;</span>
            <span className="brand-text">zcoin<span className="brand-dim">.bio</span></span>
          </NavLink>
          <div className="navbar-links">
            <NavLink to="/wallet" className={navCls}>Wallet</NavLink>
            <NavLink to="/mine" className={navCls}>Mine</NavLink>
            <NavLink to="/transfer" className={navCls}>Transfer</NavLink>
            <NavLink to="/network" className={navCls}>Network</NavLink>
          </div>
        </div>
      </nav>
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
  display: flex; align-items: center; justify-content: space-between;
}
.navbar-brand {
  display: flex; align-items: center; gap: 0.5rem;
  font-weight: 800; font-size: 1.15rem; color: var(--text);
  text-decoration: none;
}
.brand-icon { color: var(--primary); font-size: 1.3rem; }
.brand-dim { color: var(--text-muted); font-weight: 500; }
.navbar-links { display: flex; gap: 0.25rem; }
.nav-link {
  padding: 0.45rem 0.9rem; border-radius: var(--radius);
  font-size: 0.85rem; font-weight: 500; color: var(--text-muted);
  text-decoration: none; transition: all 0.15s;
}
.nav-link:hover { color: var(--text); background: var(--bg-card); text-decoration: none; }
.nav-link-active { color: var(--primary); background: var(--primary-glow); }
@media (max-width: 640px) {
  .nav-link { padding: 0.4rem 0.55rem; font-size: 0.78rem; }
  .navbar-brand { font-size: 1rem; }
}
`;
