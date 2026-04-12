import { useMemo } from "react";

interface GelLane {
  label: string;
  fragments: number[];
  color?: string;
  highlight?: boolean;
}

interface GelElectrophoresisProps {
  lanes: GelLane[];
  height?: number;
  showLabels?: boolean;
  showLadder?: boolean;
  compact?: boolean;
}

const DEFAULT_LADDER = [500, 400, 300, 200, 150, 100, 75, 50, 30, 15];

export function GelElectrophoresis({
  lanes,
  height = 260,
  showLabels = true,
  showLadder = true,
  compact = false,
}: GelElectrophoresisProps) {
  const maxFrag = useMemo(() => {
    let max = 0;
    for (const lane of lanes) {
      for (const f of lane.fragments) {
        if (f > max) max = f;
      }
    }
    return Math.max(max, 200);
  }, [lanes]);

  const laneWidth = compact ? 28 : 40;
  const gutterWidth = compact ? 2 : 4;
  const ladderWidth = showLadder ? (compact ? 20 : 30) : 0;
  const totalWidth = ladderWidth + (lanes.length * (laneWidth + gutterWidth)) + gutterWidth + 2;
  const gelHeight = height - (showLabels ? 28 : 0);

  const fragToY = (len: number) => {
    const ratio = len / maxFrag;
    const logPos = 1 - (Math.log(ratio * 100 + 1) / Math.log(101));
    return 8 + logPos * (gelHeight - 16);
  };

  return (
    <div className="gel-wrap" style={{ width: totalWidth }}>
      <svg
        width={totalWidth}
        height={gelHeight}
        className="gel-svg"
        viewBox={`0 0 ${totalWidth} ${gelHeight}`}
      >
        <defs>
          <linearGradient id="gelBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0e14" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <filter id="bandGlow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" />
          </filter>
        </defs>

        <rect x={0} y={0} width={totalWidth} height={gelHeight} rx={4} fill="url(#gelBg)" />

        {showLadder && (
          <g>
            {DEFAULT_LADDER.filter((l) => l <= maxFrag).map((len, i) => {
              const y = fragToY(len);
              return (
                <g key={i}>
                  <rect
                    x={4}
                    y={y - 1}
                    width={ladderWidth - 8}
                    height={2}
                    fill="rgba(100,116,139,0.5)"
                    rx={1}
                  />
                  <text
                    x={ladderWidth - 2}
                    y={y + 3}
                    fill="rgba(100,116,139,0.4)"
                    fontSize={compact ? 6 : 7}
                    textAnchor="end"
                  >
                    {len}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {lanes.map((lane, li) => {
          const x = ladderWidth + gutterWidth + li * (laneWidth + gutterWidth);
          const bandColor = lane.color || (lane.highlight ? "#22c55e" : "#38bdf8");
          const glowColor = lane.highlight ? "rgba(34,197,94,0.3)" : "rgba(56,189,248,0.2)";

          return (
            <g key={li}>
              <rect
                x={x}
                y={0}
                width={laneWidth}
                height={gelHeight}
                fill="rgba(255,255,255,0.015)"
                rx={2}
              />

              <line
                x1={x + laneWidth / 2}
                y1={0}
                x2={x + laneWidth / 2}
                y2={gelHeight}
                stroke="rgba(255,255,255,0.03)"
                strokeWidth={laneWidth - 4}
              />

              {lane.fragments.filter((f) => f > 0 && f <= maxFrag).map((frag, fi) => {
                const y = fragToY(frag);
                const bandWidth = Math.max(6, laneWidth - 8);
                const bandHeight = Math.max(2, Math.min(5, Math.ceil(frag / maxFrag * 4) + 1));

                return (
                  <g key={fi}>
                    <rect
                      x={x + (laneWidth - bandWidth) / 2}
                      y={y - bandHeight / 2}
                      width={bandWidth}
                      height={bandHeight}
                      fill={glowColor}
                      filter="url(#bandGlow)"
                      rx={1}
                    />
                    <rect
                      x={x + (laneWidth - bandWidth) / 2}
                      y={y - bandHeight / 2}
                      width={bandWidth}
                      height={bandHeight}
                      fill={bandColor}
                      opacity={0.85}
                      rx={1}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}

        <rect
          x={0} y={0} width={totalWidth} height={gelHeight}
          rx={4} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1}
        />
      </svg>

      {showLabels && (
        <div className="gel-labels" style={{ paddingLeft: ladderWidth }}>
          {showLadder && <div className="gel-label" style={{ width: ladderWidth }}>L</div>}
          {lanes.map((lane, i) => (
            <div
              key={i}
              className={`gel-label ${lane.highlight ? "gel-label-hl" : ""}`}
              style={{ width: laneWidth + gutterWidth }}
            >
              {lane.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface GelComparisonProps {
  networkFragments: number[];
  coinFragments: number[];
  coinLabel?: string;
  height?: number;
  compact?: boolean;
}

export function GelComparison({
  networkFragments,
  coinFragments,
  coinLabel = "Coin",
  height = 220,
  compact = false,
}: GelComparisonProps) {
  const lanes: GelLane[] = [
    { label: "Net", fragments: networkFragments, color: "#a855f7", highlight: false },
    { label: coinLabel, fragments: coinFragments, color: "#22c55e", highlight: true },
  ];

  return <GelElectrophoresis lanes={lanes} height={height} compact={compact} />;
}

export function GelMultiCoin({
  networkFragments,
  coins,
  height = 280,
}: {
  networkFragments: number[];
  coins: { label: string; fragments: number[]; valid?: boolean }[];
  height?: number;
}) {
  const lanes: GelLane[] = [
    { label: "Net", fragments: networkFragments, color: "#a855f7" },
    ...coins.map((c) => ({
      label: c.label,
      fragments: c.fragments,
      color: c.valid !== false ? "#22c55e" : "#ef4444",
      highlight: c.valid !== false,
    })),
  ];

  return <GelElectrophoresis lanes={lanes} height={height} showLadder compact={coins.length > 4} />;
}
