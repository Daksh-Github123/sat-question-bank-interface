"use client";

import { useState } from "react";

export interface DayBar {
  label: string; // short axis label e.g. "Jul 3"
  value: number;
  full: string; // tooltip text
}

/**
 * A compact daily bar chart. Bars grow in on mount, brighten and lift a value
 * label on hover. Single hue, rounded tops, recessive axis.
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
  const [hover, setHover] = useState<number | null>(null);

  if (bars.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">No activity yet.</p>;
  }
  const W = 600;
  const H = 150;
  const pad = { l: 28, r: 8, t: 16, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = bars.length;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = iw / n;
  const gap = Math.min(3, slot * 0.25);
  const bw = Math.max(1, slot - gap);
  const baseline = pad.t + ih;

  const labelIdx = new Set([0, Math.floor(n / 2), n - 1]);
  const hb = hover != null ? bars[hover] : null;
  const hx = hover != null ? pad.l + hover * slot + slot / 2 : 0;

  return (
    <div className="overflow-x-auto">
      <style>{`@keyframes dbGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}`}</style>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 320 }}
        role="img"
        aria-label="Daily activity"
        onMouseLeave={() => setHover(null)}
      >
        {/* baseline + max gridline */}
        <line x1={pad.l} x2={W - pad.r} y1={baseline} y2={baseline} stroke="#e2e8f0" strokeWidth={1} />
        <line x1={pad.l} x2={W - pad.r} y1={pad.t} y2={pad.t} stroke="#f1f5f9" strokeWidth={1} />
        <text x={pad.l - 5} y={pad.t + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
          {max}
          {suffix}
        </text>
        <text x={pad.l - 5} y={baseline} textAnchor="end" fontSize={10} fill="#94a3b8">0</text>

        {bars.map((b, i) => {
          const h = b.value <= 0 ? 0 : Math.max(2, (b.value / max) * ih);
          const x = pad.l + i * slot + gap / 2;
          const isHover = hover === i;
          return (
            <g key={i}>
              {/* full-height hover target */}
              <rect
                x={pad.l + i * slot}
                y={pad.t}
                width={slot}
                height={ih}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              >
                <title>{b.full}</title>
              </rect>
              {h > 0 && (
                <rect
                  x={x}
                  y={baseline - h}
                  width={bw}
                  height={h}
                  rx={2}
                  fill={color}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "bottom",
                    animation: `dbGrow .5s cubic-bezier(.2,.7,.2,1) both`,
                    animationDelay: `${Math.min(i * 12, 360)}ms`,
                    opacity: hover == null || isHover ? 1 : 0.45,
                    transition: "opacity .15s ease",
                    pointerEvents: "none",
                  }}
                />
              )}
              {labelIdx.has(i) && (
                <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize={9} fill="#94a3b8">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}

        {/* hover readout */}
        {hb && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={pad.t} y2={baseline} stroke={color} strokeWidth={1} strokeOpacity={0.25} />
            <text x={hx} y={pad.t - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="#334155">
              {hb.value}
              {suffix} · {hb.label}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
