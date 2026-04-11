import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../api";
import type { DemoUser } from "../store";

interface OutletCtx {
  user: DemoUser | null;
  setUser: (u: DemoUser | null) => void;
  networkUrl: string;
}

export function Sell() {
  const { user } = useOutletContext<OutletCtx>();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(1);
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError("");
    try {
      const listing = await api.createListing({
        title,
        description,
        price,
        imageUrl: imageUrl || undefined,
        sellerPublicKeyHash: user.publicKeyHash,
      });
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
            You need to connect your zcoin wallet to list items for sale.
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
      <h1 className="mb-2">List an Item</h1>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field">
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you selling?" required />
          </div>

          <div className="field">
            <label className="label">Description</label>
            <textarea className="textarea" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your item..." required />
          </div>

          <div className="field">
            <label className="label">Price (in coins)</label>
            <input className="input" type="number" min={1} value={price}
              onChange={(e) => setPrice(parseInt(e.target.value) || 1)} required />
          </div>

          <div className="field">
            <label className="label">Image URL (optional)</label>
            <input className="input" value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg" />
          </div>

          {error && (
            <div style={{ color: "var(--danger)", marginBottom: "1rem", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}

          <div className="flex gap-1">
            <button className="btn btn-primary" type="submit" disabled={submitting || !title || !description}>
              {submitting ? "Creating..." : "Create Listing"}
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
          When a buyer purchases your item, coins are transferred to your wallet
          via the zcoin payment gateway. You can then import the mRNA transfers
          on <a href="https://zcoin.bio/transfer" target="_blank" rel="noopener">zcoin.bio</a>.
        </p>
      </div>
    </div>
  );
}
