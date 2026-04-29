"use client";

const LABELS = ["Técnica", "Segurança", "Ergonomia", "Compliance", "Soft skills"];

/** Gráfico radar simples (SVG). Valores 0–100. */
export function RadarCompetencyChart({ values }: { values: number[] }) {
  const n = LABELS.length;
  const pts = values.slice(0, n);
  while (pts.length < n) pts.push(40);
  const max = 100;
  const cx = 120;
  const cy = 120;
  const r = 88;
  const angle = (i: number) => (-Math.PI / 2 + (2 * Math.PI * i) / n);
  const coord = (i: number, rad: number) => {
    const a = angle(i);
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)] as const;
  };
  const poly = pts
    .map((v, i) => {
      const rad = (v / max) * r;
      const [x, y] = coord(i, rad);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={240} height={240} viewBox="0 0 240 240" className="text-cyan-400/40">
        {[0.25, 0.5, 0.75, 1].map((s) => (
          <polygon
            key={s}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.5}
            points={Array.from({ length: n })
              .map((_, i) => {
                const [x, y] = coord(i, r * s);
                return `${x},${y}`;
              })
              .join(" ")}
          />
        ))}
        <polygon fill="rgba(34,211,238,0.25)" stroke="rgb(34,211,238)" strokeWidth={1.5} points={poly} />
        {LABELS.map((lbl, i) => {
          const [x, y] = coord(i, r + 22);
          return (
            <text
              key={lbl}
              x={x}
              y={y}
              textAnchor="middle"
              className="fill-zinc-400 text-[9px] font-medium"
            >
              {lbl}
            </text>
          );
        })}
      </svg>
      <div className="grid w-full grid-cols-2 gap-2 text-[11px] text-zinc-400 sm:grid-cols-5">
        {LABELS.map((lbl, i) => (
          <div key={lbl} className="rounded-md bg-zinc-900/80 px-2 py-1 text-center">
            <p className="font-semibold text-zinc-300">{pts[i]}</p>
            <p>{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
