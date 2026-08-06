"use client";

import { useState } from "react";

// "New concerns surfaced" — concerns by the month they were first identified,
// across the trust. A quiet line with a light fill (never a heavy area under a
// spike), three horizontal guide lines, hover tooltips, a data label on the
// peak, and the current month called out. A 12-months / This-term toggle lets
// the reader zoom to the current term. All real data.
export function ConcernTrend({
  labels,
  values,
  currentLabel,
}: {
  labels: string[];
  values: number[];
  currentLabel: string;
}) {
  const [range, setRange] = useState<"year" | "term">("year");
  const [hover, setHover] = useState<number | null>(null);

  const start = range === "term" ? Math.max(0, values.length - 4) : 0;
  const L = labels.slice(start);
  const V = values.slice(start);
  const total = V.reduce((a, b) => a + b, 0);

  const W = 640;
  const H = 200;
  const padL = 34;
  const padR = 12;
  const padT = 18;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(1, ...V);
  // Round the axis top up to a "nice" number so the guide lines read cleanly.
  const niceMax = niceCeil(max);
  const stepX = V.length > 1 ? innerW / (V.length - 1) : 0;
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => padT + innerH - (v / niceMax) * innerH;

  const peakIndex = V.indexOf(Math.max(...V));
  const guides = [0, 0.5, 1].map((f) => Math.round(niceMax * f));

  const points = V.map((v, i) => `${x(i)},${y(v)}`);
  const linePath = `M ${points.join(" L ")}`;
  const areaPath =
    V.length > 1
      ? `${linePath} L ${x(V.length - 1)},${padT + innerH} L ${x(0)},${padT + innerH} Z`
      : "";

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-[650]">New concerns surfaced</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Concerns first identified during each month across the trust.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="whitespace-nowrap rounded-md bg-paper px-2 py-1 text-xs font-medium text-ink">
            {total.toLocaleString("en-GB")} this {range === "term" ? "term" : "year"}
          </span>
          <div className="inline-flex rounded-lg border border-[var(--card-border)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setRange("year")}
              className={`rounded-md px-2 py-1 font-medium transition-colors ${range === "year" ? "bg-cobalt text-white" : "text-muted-foreground hover:text-ink"}`}
            >
              12 months
            </button>
            <button
              type="button"
              onClick={() => setRange("term")}
              className={`rounded-md px-2 py-1 font-medium transition-colors ${range === "term" ? "bg-cobalt text-white" : "text-muted-foreground hover:text-ink"}`}
            >
              This term
            </button>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`New concerns surfaced by month: ${L.map((m, i) => `${m} ${V[i]}`).join(", ")}`}
      >
        <defs>
          <linearGradient id="concern-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cobalt)" stopOpacity={0.08} />
            <stop offset="100%" stopColor="var(--cobalt)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Horizontal guide lines + Y labels */}
        {guides.map((g) => (
          <g key={g}>
            <line
              x1={padL}
              y1={y(g)}
              x2={W - padR}
              y2={y(g)}
              stroke="var(--card-border)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(g) + 3}
              textAnchor="end"
              className="fill-[var(--muted-foreground)] text-[10px]"
            >
              {g}
            </text>
          </g>
        ))}

        {areaPath ? <path d={areaPath} fill="url(#concern-fill)" /> : null}
        <path
          d={linePath}
          fill="none"
          stroke="var(--cobalt)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Month labels; the last is called out as the current month */}
        {L.map((m, i) => (
          <text
            key={m}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            className={`text-[10px] ${i === L.length - 1 ? "fill-[var(--ink)] font-semibold" : "fill-[var(--muted-foreground)]"}`}
          >
            {i === L.length - 1 ? `${currentLabel} · now` : m}
          </text>
        ))}

        {/* Peak data label */}
        {V.length > 1 ? (
          <text
            x={x(peakIndex)}
            y={y(V[peakIndex]!) - 8}
            textAnchor="middle"
            className="fill-[var(--ink)] text-[11px] font-semibold"
          >
            {V[peakIndex]}
          </text>
        ) : null}

        {/* Hover points + tooltip */}
        {V.map((v, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(v)}
              r={hover === i ? 4 : 2.5}
              fill="var(--cobalt)"
            />
            <rect
              x={x(i) - stepX / 2}
              y={padT}
              width={Math.max(stepX, 12)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
        {hover !== null ? (
          <g>
            <rect
              x={Math.min(Math.max(x(hover) - 34, padL), W - padR - 68)}
              y={y(V[hover]!) - 34}
              width={68}
              height={24}
              rx={6}
              fill="var(--ink)"
            />
            <text
              x={Math.min(Math.max(x(hover) - 34, padL), W - padR - 68) + 34}
              y={y(V[hover]!) - 18}
              textAnchor="middle"
              className="fill-white text-[10px] font-medium"
            >
              {L[hover]}: {V[hover]}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}
