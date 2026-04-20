import { useState, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../api";
import type { MarketUser } from "../store";

interface OutletCtx {
  user: MarketUser | null;
  networkUrl: string;
}

export function Sell() {
  const { user } = useOutletContext<OutletCtx>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) return;
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("price", price.toString());
      formData.append("sellerPublicKeyHash", user.publicKeyHash);
      formData.append("file", file);

      const listing = await api.createListing(formData);
      navigate(`/item/${listing.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <h2>Connect Your Wallet</h2>
          <p className="text-muted mt-1">
            You need to connect your BioCrypt wallet to list files for sale.
          </p>
          <p className="text-muted text-sm mt-1">
            Use the "Connect Wallet" button in the navigation bar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <h1 className="mb-2">Sell a File</h1>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field">
            <label className="label">File</label>
            <div
              className={`file-drop ${file ? "file-drop-active" : ""}`}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>{"\u{1F4C4}"}</div>
                  <div className="text-sm" style={{ fontWeight: 600 }}>{file.name}</div>
                  <div className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "2rem", opacity: 0.4, marginBottom: "0.5rem" }}>{"\u{2B06}\u{FE0F}"}</div>
                  <div className="text-sm" style={{ fontWeight: 600 }}>Click to select a file</div>
                  <div className="text-xs text-muted">Max 100 MB</div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your file listing" required />
          </div>

          <div className="field">
            <label className="label">Description</label>
            <textarea className="textarea" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this file contains..." required />
          </div>

          <div className="field">
            <label className="label">Price (ZBIO)</label>
            <input className="input" type="number" min={1} value={price}
              onChange={(e) => setPrice(parseInt(e.target.value) || 1)} required />
          </div>

          {error && (
            <div style={{ color: "var(--danger)", marginBottom: "1rem", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}

          <div className="flex gap-1">
            <button className="btn btn-primary" type="submit" disabled={submitting || !title || !description || !file}>
              {submitting ? "Uploading..." : "List for Sale"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => navigate("/")}>
              Cancel
            </button>
          </div>
        </div>
      </form>

      <div className="card mt-2" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
        <p>
          <b>Seller:</b> <span className="mono">{user.publicKeyHash.slice(0, 20)}...</span>
        </p>
        <p className="mt-1">
          When someone buys your file, ZBIO coins are transferred to your wallet.
          You can claim them by importing the mRNA transfers on{" "}
          <a href="https://www.biocrypt.net/transfer" target="_blank" rel="noopener">www.biocrypt.net</a>.
        </p>
      </div>
    </div>
  );
}
