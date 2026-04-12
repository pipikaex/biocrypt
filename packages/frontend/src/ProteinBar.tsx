import React from "react";

const AMINO_COLORS: Record<string, string> = {
  Met: "#22c55e", // green — start codon marker
  Gly: "#a855f7", // purple
  Trp: "#ec4899", // pink
  Cys: "#eab308", // yellow
  Phe: "#f97316", // orange
  Leu: "#3b82f6", // blue
  Ile: "#06b6d4", // cyan
  Val: "#14b8a6", // teal
  Ser: "#ef4444", // red
  Pro: "#8b5cf6", // violet
  Thr: "#10b981", // emerald
  Ala: "#6366f1", // indigo
  Tyr: "#f59e0b", // amber
  His: "#d946ef", // fuchsia
  Gln: "#0ea5e9", // sky
  Asn: "#84cc16", // lime
  Lys: "#f43f5e", // rose
  Asp: "#fb923c", // orange light
  Glu: "#38bdf8", // sky light
  Arg: "#c084fc", // purple light
};

const FALLBACK_COLOR = "#64748b";

interface ProteinBarProps {
  aminoAcids: string[];
  height?: number;
  maxWidth?: number;
  showTooltip?: boolean;
}

export function ProteinBar({ aminoAcids, height = 14, maxWidth, showTooltip = true }: ProteinBarProps) {
  const barWidth = Math.max(2, Math.min(6, maxWidth ? Math.floor(maxWidth / aminoAcids.length) : 4));

  return (
    <div
      className="protein-bar"
      style={{ maxWidth: maxWidth || "100%" }}
      title={showTooltip ? aminoAcids.join("-") : undefined}
    >
      {aminoAcids.map((aa, i) => (
        <span
          key={i}
          className="protein-bar-sq"
          style={{
            backgroundColor: AMINO_COLORS[aa] || FALLBACK_COLOR,
            width: barWidth,
            height,
          }}
          title={aa}
        />
      ))}
    </div>
  );
}

export function ProteinBarInline({ aminoAcids, height = 10 }: { aminoAcids: string[]; height?: number }) {
  return (
    <span className="protein-bar-inline">
      {aminoAcids.map((aa, i) => (
        <span
          key={i}
          className="protein-bar-sq"
          style={{
            backgroundColor: AMINO_COLORS[aa] || FALLBACK_COLOR,
            width: 3,
            height,
          }}
          title={aa}
        />
      ))}
    </span>
  );
}
