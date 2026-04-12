import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
      <div style={{ fontSize: "4rem", marginBottom: "1rem", opacity: 0.4 }}>{"\u{1F9EC}"}</div>
      <h1 style={{ fontSize: "4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
        <span className="grad-text">404</span>
      </h1>
      <p className="text-muted" style={{ fontSize: "1.1rem", marginBottom: "2rem", maxWidth: 400, margin: "0 auto 2rem" }}>
        This strand of DNA doesn't exist in our genome.
        The page you're looking for may have mutated or been removed.
      </p>
      <div className="flex gap-1 justify-center">
        <Link to="/" className="btn btn-primary">Go Home</Link>
        <Link to="/network" className="btn btn-secondary">View Network</Link>
      </div>
    </div>
  );
}
