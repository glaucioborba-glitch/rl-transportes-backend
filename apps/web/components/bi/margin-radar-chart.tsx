"use client";

const LABELS = ["Margem %", "Ticket / op.", "Lucro", "Container $", "Rentab."];

export function MarginRadarChart({
  values,
}: {
  values: { margemPct: number; ticket: number; lucroNorm: number; container: number; rentab: number };
}) {
  const pts = [values.margemPct, values.ticket, values.lucroNorm, values.container, values.rentab];
  const n = 5;
  const cx = 120;
  const cy = 120;
  const r = 72;
  const coords = pts.map((v, i) => {
    const a = (-Math.PI / 2 + (2 * Math.PI * i) / n);
    const rr = (v / 100) * r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  });
  const poly = coords.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <div className="flex flex-col items-center">
      <svg width={240} height={240} viewBox="0 0 240 240">
        {[0.25, 0.5, 0.75, 1].map((s) => (
          <polygon
            key={s}
            fill="none"
            stroke="rgba(148,163,184,0.3)"
            strokeWidth={0.5}
            points={Array.from({ length: n })
              .map((_, i) => {
                const a = (-Math.PI / 2 + (2 * Math.PI * i) / n);
                const x = cx + r * s * Math.cos(a);
                const y = cy + r * s * Math.sin(a);
                return `${x},${y}`;
              })
              .join(" ")}
          />
        ))}
        <polygon fill="rgba(34,211,238,0.2)" stroke="rgb(34,211,238)" strokeWidth={1.5} points={poly} />
        {LABELS.map((lbl, i) => {
          const a = (-Math.PI / 2 + (2 * Math.PI * i) / n);
          const x = cx + (r + 22) * Math.cos(a);
          const y = cy + (r + 22) * Math.sin(a);
          return (
            <text key={lbl} x={x} y={y} textAnchor="middle" className="fill-zinc-400 text-[8px]">
              {lbl}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
