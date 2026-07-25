"use client";

export interface DayBar {
  label: string; // short axis label e.g. "Jul 3"
  value: number;
  full: string; // tooltip text
}

/**
 * A compact daily bar chart. Single hue, rounded bar tops anchored to the
 * baseline, a 2px gap between bars, recessive axis, per-bar hover title.
 */
export default function DailyBars({
  bars,
  color = "#4f46e5",
  suffix = "",
}: {
  bars: DayBar[];
  color?: string;
  suffix?: string;
}) {
  if (bars.length === 0) {
    return <p className="text-sm text-slate-400">No activity yet.</p>;
  }
  const W = 600;
  const H = 150;
  const pad = { l: 28, r: 8, t: 12, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = bars.length;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = iw / n;
  const gap = Math.min(3, slot * 0.25);
  const bw = Math.max(1, slot - gap);
  const y = (v: number) => pad.t + (1 - v / max) * ih;

  const labelIdx = new Set([0, Math.floor(n / 2), n - 1]);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }} role="img" aria-label="Daily activity">
        {/* baseline + max gridline */}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="#e2e8f0" strokeWidth={1} />
        <line x1={pad.l} x2={W - pad.r} y1={pad.t} y2={pad.t} stroke="#f1f5f9" strokeWidth={1} />
        <text x={pad.l - 5} y={pad.t + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
          {max}
          {suffix}
        </text>
        <text x={pad.l - 5} y={pad.t + ih} textAnchor="end" fontSize={10} fill="#94a3b8">0</text>

        {bars.map((b, i) => {
          const h = b.value <= 0 ? 0 : Math.max(2, (b.value / max) * ih);
          const x = pad.l + i * slot + gap / 2;
          return (
            <g key={i}>
              {h > 0 && (
                <rect x={x} y={pad.t + ih - h} width={bw} height={h} rx={2} fill={color}>
                  <title>{b.full}</title>
                </rect>
              )}
              {labelIdx.has(i) && (
                <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize={9} fill="#94a3b8">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
