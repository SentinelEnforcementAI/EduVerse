// A tiny inline trend line. Presentational only: it plots a real series handed
// to it (in this app, monthly behaviour-incident volume — genuine data, never
// invented). Cobalt by default because a volume trend is not risk on a child;
// pass a risk tone only for a genuinely risk-banded series.
export function Sparkline({
  data,
  tone = "cobalt",
  width = 96,
  height = 28,
  className,
}: {
  data: number[];
  tone?: "cobalt" | "risk" | "warning" | "success";
  width?: number;
  height?: number;
  className?: string;
}) {
  const stroke =
    tone === "risk"
      ? "var(--risk-red)"
      : tone === "warning"
        ? "var(--warning-amber)"
        : tone === "success"
          ? "var(--success-green)"
          : "var(--cobalt)";

  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label="No trend data"
      >
        <line
          x1={0}
          y1={height - 2}
          x2={width}
          y2={height - 2}
          stroke="var(--cloud)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / (data.length - 1);
  const y = (v: number) =>
    height - pad - ((v - min) / span) * (height - pad * 2);
  const points = data.map((v, i) => `${pad + i * stepX},${y(v)}`);
  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${pad + (data.length - 1) * stepX},${height - pad} L ${pad},${height - pad} Z`;
  const gradId = `spark-${tone}-${data.length}-${Math.round(max)}`;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Twelve month trend"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
