import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Listing, formatFileSize } from "../api";

const FILE_ICONS: Record<string, string> = {
  pdf: "\u{1F4C4}", zip: "\u{1F4E6}", rar: "\u{1F4E6}", "7z": "\u{1F4E6}",
  png: "\u{1F5BC}", jpg: "\u{1F5BC}", jpeg: "\u{1F5BC}", gif: "\u{1F5BC}", webp: "\u{1F5BC}", svg: "\u{1F5BC}",
  mp4: "\u{1F3AC}", mov: "\u{1F3AC}", avi: "\u{1F3AC}", mkv: "\u{1F3AC}",
  mp3: "\u{1F3B5}", wav: "\u{1F3B5}", flac: "\u{1F3B5}",
  doc: "\u{1F4DD}", docx: "\u{1F4DD}", txt: "\u{1F4DD}", md: "\u{1F4DD}",
  xls: "\u{1F4CA}", xlsx: "\u{1F4CA}", csv: "\u{1F4CA}",
  psd: "\u{1F3A8}", ai: "\u{1F3A8}", fig: "\u{1F3A8}",
  js: "\u{1F4BB}", ts: "\u{1F4BB}", py: "\u{1F4BB}", rs: "\u{1F4BB}", go: "\u{1F4BB}", c: "\u{1F4BB}",
};

function getIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || "\u{1F4C1}";
}

export function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getListings().then(setListings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="home-header">
        <h1>File Marketplace</h1>
        <p className="text-muted">
          Buy and sell digital files with ZBIO. All payments processed via the{" "}
          <a href="https://www.biocrypt.net" target="_blank" rel="noopener">BioCrypt</a> network.
        </p>
        <div className="home-actions mt-2">
          <Link to="/sell" className="btn btn-primary">Sell a File</Link>
        </div>
      </div>

      {loading ? (
        <div className="home-loading">Loading files...</div>
      ) : listings.length === 0 ? (
        <div className="home-empty">
          <div className="home-empty-icon">{"\u{1F4C1}"}</div>
          <h3>No files listed yet</h3>
          <p className="text-muted">Be the first to list a file for sale!</p>
          <Link to="/sell" className="btn btn-primary mt-2">List Your File</Link>
        </div>
      ) : (
        <div className="listings-grid">
          {listings.map((item) => (
            <Link to={`/item/${item.id}`} key={item.id} className="listing-card">
              <div className="listing-icon-area">
                <span className="listing-file-icon">{getIcon(item.fileName)}</span>
                <span className="listing-ext">{item.fileName.split(".").pop()?.toUpperCase()}</span>
              </div>
              <div className="listing-body">
                <h3 className="listing-title">{item.title}</h3>
                <p className="listing-desc">{item.description.slice(0, 80)}{item.description.length > 80 ? "..." : ""}</p>
                <div className="listing-meta">
                  <span className="text-xs text-muted">{item.fileName}</span>
                  <span className="text-xs text-muted">{formatFileSize(item.fileSize)}</span>
                </div>
                <div className="listing-footer">
                  <span className="listing-price">{item.price} ZBIO</span>
                  {item.status === "sold" && <span className="listing-sold-badge">SOLD</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
