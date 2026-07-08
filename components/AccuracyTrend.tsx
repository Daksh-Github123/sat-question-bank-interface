"use client";

export interface TrendPoint {
  label: string; // date label
  accuracy: number; // 0-100
  total: number;
}

/**
 * Single-series accuracy-over-time line. One hue (brand indigo), recessive grid,
 * the latest value direct-labeled, per-point <title> for hover. A single series
 * needs no legend — the section title names it.
 */
export default function AccuracyTrend({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-400">Not enough data yet — practice on a few different days to see your trend.</p>;
  }

  const W = 640;
  const H = 180;
  const pad = { l: 34, r: 16, t: 14, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = points.length;
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + (1 - v / 100) * ih;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.accuracy)}`).join(" ");
  const area = `${line} L${x(n - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`;
  const last = points[n - 1];

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 380 }} role="img"
        aria-label={`Accuracy over time; latest ${Math.round(last.accuracy)} percent`}>
        {/* gridlines */}
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.l - 6} y={y(g) + 3} textAnchor="end" fontSize={10} fill="#94a3b8">{g}%</text>
          </g>
        ))}
        <path d={area} fill="#4f46e5" fillOpacity={0.08} />
        <path d={line} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.accuracy)} r={3.5} fill="#4f46e5">
            <title>{`${p.label}: ${Math.round(p.accuracy)}% (${p.total} question${p.total === 1 ? "" : "s"})`}</title>
          </circle>
        ))}
        {/* direct-label latest */}
        <text x={x(n - 1)} y={y(last.accuracy) - 8} textAnchor="end" fontSize={11} fontWeight={700} fill="#4338ca">
          {Math.round(last.accuracy)}%
        </text>
        {/* first & last date labels */}
        <text x={x(0)} y={H - 8} textAnchor="start" fontSize={10} fill="#94a3b8">{points[0].label}</text>
        {n > 1 && <text x={x(n - 1)} y={H - 8} textAnchor="end" fontSize={10} fill="#94a3b8">{last.label}</text>}
      </svg>
    </div>
  );
}
