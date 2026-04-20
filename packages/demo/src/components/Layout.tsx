import { NavLink, Outlet } from "react-router-dom";
import { useUser } from "../store";

const BIOCRYPT_NETWORK = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://www.biocrypt.net";

export function Layout() {
  const { user, setUser } = useUser();

  const handleConnect = () => {
    const pkh = prompt("Enter your BioCrypt public key hash (from your wallet on www.biocrypt.net):");
    if (pkh && pkh.length >= 10) {
      setUser({ publicKeyHash: pkh, connectedAt: Date.now() });
    }
  };

  return (
    <>
      <nav className="fm-nav">
        <div className="fm-nav-inner">
          <NavLink to="/" className="fm-brand">
            <span className="fm-brand-icon">&#x29D6;</span>
            <span>BioCrypt <b>Files</b></span>
          </NavLink>
          <div className="fm-nav-links">
            <NavLink to="/" className={navCls}>Browse</NavLink>
            <NavLink to="/sell" className={navCls}>Sell a File</NavLink>
            <NavLink to="/my" className={navCls}>My Files</NavLink>
          </div>
          <div className="fm-nav-right">
            {user ? (
              <div className="fm-user">
                <span className="fm-user-dot" />
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
      <Outlet context={{ user, setUser, networkUrl: BIOCRYPT_NETWORK }} />
      <footer className="fm-footer">
        <div className="container">
          <p>
            A file marketplace powered by{" "}
            <a href={BIOCRYPT_NETWORK} target="_blank" rel="noopener">BioCrypt</a>{" "}
            payment gateway. All transactions use real ZBIO coins.
          </p>
          <p className="text-xs text-muted mt-1">
            Create your wallet and mine ZBIO at{" "}
            <a href={BIOCRYPT_NETWORK} target="_blank" rel="noopener">www.biocrypt.net</a>
          </p>
        </div>
      </footer>
    </>
  );
}

function navCls({ isActive }: { isActive: boolean }) {
  return `nav-link${isActive ? " nav-link-active" : ""}`;
}
