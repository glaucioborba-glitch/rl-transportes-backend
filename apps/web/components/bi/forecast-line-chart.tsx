"use client";

export type ForecastSeries = {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  values: (number | null)[];
};

function buildLineSegments(vals: (number | null)[], xAt: (i: number) => number, yAt: (v: number) => number): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v == null || Number.isNaN(v)) {
      if (cur.length) {
        out.push(cur.join(" "));
        cur = [];
      }
      continue;
    }
    cur.push(`${xAt(i)},${yAt(v)}`);
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

export function ForecastLineChart({
  labels,
  series,
  height = 240,
}: {
  labels: string[];
  series: ForecastSeries[];
  height?: number;
}) {
  const w = 800;
  const pad = 36;
  const numeric = series.flatMap((s) => s.values.filter((v): v is number => v != null && !Number.isNaN(v)));
  const max = Math.max(...numeric, 1e-6);
  const min = Math.min(0, ...numeric);
  const span = max - min || 1;
  const n = Math.max(labels.length, ...series.map((s) => s.values.length));
  const xAt = (i: number) => pad + (i / Math.max(n - 1, 1)) * (w - pad * 2);
  const yAt = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${height}`} className="min-w-[640px] w-full text-[10px] text-zinc-500">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad + t * (height - pad * 2);
          const val = max - t * span;
          return (
            <g key={t}>
              <line x1={pad} x2={w - pad} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.15} />
              <text x={4} y={y + 3} fill="currentColor">
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {series.map((s) =>
          buildLineSegments(s.values, xAt, yAt).map((pts, j) => (
            <polyline
              key={`${s.id}-${j}`}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "6 4" : undefined}
              points={pts}
            />
          )),
        )}
        {labels.map((lbl, i) =>
          i % Math.ceil(n / 8) === 0 ? (
            <text key={i} x={xAt(i)} y={height - 8} textAnchor="middle" fill="currentColor">
              {lbl.length > 8 ? lbl.slice(5) : lbl}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
