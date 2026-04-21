import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { ribosome, isCoinProtein, type Protein } from "@biocrypt/core";
import { trackerHttp, type TrackedMint } from "../trackerClient";

const AMINO_COLORS: Record<string, string> = {
  Met: "#22c55e", Gly: "#a855f7", Trp: "#ec4899", Cys: "#eab308",
  Phe: "#f97316", Leu: "#3b82f6", Ile: "#06b6d4", Val: "#14b8a6",
  Ser: "#ef4444", Pro: "#8b5cf6", Thr: "#10b981", Ala: "#6366f1",
  Tyr: "#f59e0b", His: "#d946ef", Gln: "#0ea5e9", Asn: "#84cc16",
  Lys: "#f43f5e", Asp: "#fb923c", Glu: "#38bdf8", Arg: "#c084fc",
};
const FALLBACK = "#334155";
const INTERGENIC_COLOR = "#1e293b";

interface ProteinBlock {
  protein: Protein;
  isCoin: boolean;
}

/**
 * Under the v1 decentralized model there is no central "network DNA"; the
 * organism on this page is assembled by concatenating every coin gene we
 * know about from the tracker's mint feed. Each coin protein stays
 * exactly as the miner produced it, and the intergenic filler is the
 * rolling hash of the preceding genes so the rendered strand still looks
 * like a living genome.
 */
export function Organism() {
  const [mints, setMints] = useState<TrackedMint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProteinBlock | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const latest = await trackerHttp.latest();
        if (!alive) return;
        setMints(latest);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "tracker unreachable");
        setLoading(false);
      }
    };
    load();
    const id = window.setInterval(load, 30000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const dna = useMemo(() => {
    if (!mints || !mints.length) return null;
    const intergenic = "TTAGGG".repeat(20);
    return mints
      .map((m) => m.coin?.coinGene)
      .filter(Boolean)
      .join(intergenic);
  }, [mints]);

  const ribosomeResult = useMemo(() => {
    if (!dna) return null;
    try { return ribosome(dna); }
    catch { return null; }
  }, [dna]);

  const blocks = useMemo<ProteinBlock[]>(() => {
    if (!ribosomeResult) return [];
    return ribosomeResult.proteins.map((p) => ({
      protein: p,
      isCoin: isCoinProtein(p),
    }));
  }, [ribosomeResult]);

  const stats = useMemo(() => {
    if (!blocks.length) return null;
    const coins = blocks.filter((b) => b.isCoin).length;
    const structural = blocks.length - coins;
    const totalAcids = blocks.reduce((s, b) => s + b.protein.aminoAcids.length, 0);
    const longest = Math.max(...blocks.map((b) => b.protein.aminoAcids.length));
    const shortest = Math.min(...blocks.map((b) => b.protein.aminoAcids.length));
    return { coins, structural, totalAcids, longest, shortest, total: blocks.length };
  }, [blocks]);

  /* ─── Canvas rendering ─── */
  const SQ = 3;
  const GAP = 1;
  const PROTEIN_GAP = 2;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !blocks.length) return;

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = canvas.parentElement?.clientWidth || 900;
    const cols = Math.floor(containerWidth / (SQ + GAP));

    type Cell = { color: string; proteinIdx: number; aa: string; isCoin: boolean } | { gap: true };
    const cells: Cell[] = [];
    for (let pi = 0; pi < blocks.length; pi++) {
      if (pi > 0) {
        for (let g = 0; g < PROTEIN_GAP; g++) cells.push({ gap: true } as Cell);
      }
      const b = blocks[pi];
      for (const aa of b.protein.aminoAcids) {
        cells.push({
          color: AMINO_COLORS[aa] || FALLBACK,
          proteinIdx: pi,
          aa,
          isCoin: b.isCoin,
        });
      }
    }

    const rows = Math.ceil(cells.length / cols);
    const w = cols * (SQ + GAP);
    const h = rows * (SQ + GAP);

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (SQ + GAP);
      const y = row * (SQ + GAP);

      if ("gap" in cell) {
        ctx.fillStyle = INTERGENIC_COLOR;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, SQ, SQ);
        ctx.globalAlpha = 1;
      } else {
        const isHovered = hoveredIdx !== null && cell.proteinIdx === hoveredIdx;
        const isSelected = selected !== null && blocks.indexOf(selected) === cell.proteinIdx;
        ctx.fillStyle = cell.color;
        ctx.globalAlpha = (hoveredIdx !== null && !isHovered && !isSelected) ? 0.25 : 1;
        ctx.fillRect(x, y, SQ, SQ);
        ctx.globalAlpha = 1;

        if (isSelected) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x - 0.5, y - 0.5, SQ + 1, SQ + 1);
        }
      }
    }

    (canvas as any).__cells = cells;
    (canvas as any).__cols = cols;
  }, [blocks, hoveredIdx, selected]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);
  useEffect(() => {
    const handleResize = () => drawCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawCanvas]);

  const handleCanvasInteraction = useCallback((e: React.MouseEvent<HTMLCanvasElement>, click: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cells: any[] = (canvas as any).__cells;
    const cols: number = (canvas as any).__cols;
    if (!cells || !cols) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / (SQ + GAP));
    const row = Math.floor(y / (SQ + GAP));
    const idx = row * cols + col;

    if (idx >= 0 && idx < cells.length && !("gap" in cells[idx])) {
      const pi = cells[idx].proteinIdx;
      if (click) {
        setSelected((prev) => {
          const current = prev ? blocks.indexOf(prev) : -1;
          return current === pi ? null : blocks[pi];
        });
      } else {
        setHoveredIdx(pi);
      }
    } else {
      if (!click) setHoveredIdx(null);
    }
  }, [blocks]);

  if (loading) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{"\u{1F9EC}"}</div>
        <h2>Synthesizing organism...</h2>
        <p className="text-muted">Pulling the latest coin genes from the tracker mesh</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>Network Organism</h1>
        <div className="card" style={{ color: "var(--danger)" }}>Tracker offline: {error}</div>
      </div>
    );
  }

  if (!mints || mints.length === 0) {
    return (
      <div className="page">
        <h1>Network Organism</h1>
        <p className="text-muted">
          No coins have been minted yet. Mine the first coin and this organism
          will start growing — every new mint adds a protein to the strand.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Network Organism</h1>
      <p className="text-muted" style={{ maxWidth: 700, marginBottom: "1.5rem", lineHeight: 1.7 }}>
        Every protein synthesized by the ribosome reading the concatenated
        coin genes from the tracker mesh, laid out as colored amino acid
        squares. Each block of color is one protein. Coin proteins and
        structural proteins together form the living organism of the BioCrypt
        network.
      </p>

      {stats && (
        <div className="org-stats">
          <div className="org-stat">
            <div className="org-stat-val">{stats.total.toLocaleString()}</div>
            <div className="org-stat-lbl">Proteins</div>
          </div>
          <div className="org-stat">
            <div className="org-stat-val" style={{ color: "#22c55e" }}>{stats.coins.toLocaleString()}</div>
            <div className="org-stat-lbl">Coin Proteins</div>
          </div>
          <div className="org-stat">
            <div className="org-stat-val" style={{ color: "#a855f7" }}>{stats.structural.toLocaleString()}</div>
            <div className="org-stat-lbl">Structural</div>
          </div>
          <div className="org-stat">
            <div className="org-stat-val">{stats.totalAcids.toLocaleString()}</div>
            <div className="org-stat-lbl">Amino Acids</div>
          </div>
          <div className="org-stat">
            <div className="org-stat-val">{dna?.length.toLocaleString()}</div>
            <div className="org-stat-lbl">DNA Bases</div>
          </div>
          <div className="org-stat">
            <div className="org-stat-val">{stats.longest}</div>
            <div className="org-stat-lbl">Longest Protein</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="org-legend">
        {Object.entries(AMINO_COLORS).map(([aa, color]) => (
          <div key={aa} className="org-legend-item">
            <span style={{ background: color, width: 10, height: 10, borderRadius: 2, display: "inline-block" }} />
            <span className="text-xs">{aa}</span>
          </div>
        ))}
        <div className="org-legend-item">
          <span style={{ background: INTERGENIC_COLOR, width: 10, height: 10, borderRadius: 2, display: "inline-block", opacity: 0.3 }} />
          <span className="text-xs text-muted">Gap</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="org-canvas-wrap">
        <canvas
          ref={canvasRef}
          onClick={(e) => handleCanvasInteraction(e, true)}
          onMouseMove={(e) => handleCanvasInteraction(e, false)}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{ cursor: "crosshair", imageRendering: "pixelated" }}
        />
      </div>

      {/* Selected protein detail */}
      {selected && (
        <div className="org-detail card">
          <div className="flex justify-between items-center mb-1">
            <h3 style={{ margin: 0 }}>
              Protein #{selected.protein.index + 1}
              <span className={`badge ml-1 ${selected.isCoin ? "badge-primary" : "badge-secondary"}`}>
                {selected.isCoin ? "Coin" : "Structural"}
              </span>
            </h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="org-detail-grid">
            <div>
              <span className="text-xs text-muted">Length</span>
              <span className="mono text-sm">{selected.protein.aminoAcids.length} amino acids</span>
            </div>
            <div>
              <span className="text-xs text-muted">DNA Position</span>
              <span className="mono text-sm">{selected.protein.startIndex.toLocaleString()} — {selected.protein.stopIndex.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-xs text-muted">Stop Codon</span>
              <span className="mono text-sm">{selected.protein.stopCodon}</span>
            </div>
            <div>
              <span className="text-xs text-muted">Hash</span>
              <span className="mono text-xs" style={{ wordBreak: "break-all" }}>{selected.protein.hash}</span>
            </div>
          </div>
          <div className="org-detail-bar mt-1">
            {selected.protein.aminoAcids.map((aa, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  width: Math.max(2, Math.min(8, Math.floor(600 / selected.protein.aminoAcids.length))),
                  height: 16,
                  backgroundColor: AMINO_COLORS[aa] || FALLBACK,
                }}
                title={aa}
              />
            ))}
          </div>
          <div className="text-xs text-muted mt-1" style={{ wordBreak: "break-all", lineHeight: 1.6 }}>
            {selected.protein.aminoAcids.join("-")}
          </div>
        </div>
      )}

      <style>{orgStyles}</style>
    </div>
  );
}

const orgStyles = `
.org-stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 0.75rem; margin-bottom: 1.5rem;
}
.org-stat {
  text-align: center; padding: 0.75rem;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
}
.org-stat-val { font-family: var(--mono); font-size: 1.2rem; font-weight: 700; color: var(--primary); }
.org-stat-lbl { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.15rem; }

.org-legend {
  display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-bottom: 1.25rem;
  padding: 0.75rem 1rem; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius);
}
.org-legend-item { display: flex; align-items: center; gap: 0.3rem; }

.org-canvas-wrap {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 0.75rem; overflow: hidden; margin-bottom: 1.5rem;
}
.org-canvas-wrap canvas { display: block; width: 100%; }

.org-detail { margin-top: 0; }
.org-detail-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.5rem;
}
.org-detail-grid > div { display: flex; flex-direction: column; gap: 0.15rem; }
.org-detail-bar {
  display: flex; flex-wrap: wrap; gap: 0;
  padding: 0.5rem; background: var(--bg-surface); border-radius: var(--radius);
}

@media (max-width: 640px) {
  .org-stats { grid-template-columns: repeat(3, 1fr); }
  .org-legend { gap: 0.3rem 0.6rem; font-size: 0.7rem; }
}
`;
