"use client";

export function CapexSimulationChart({
  atual,
  apos,
  labels,
}: {
  atual: number;
  apos: number;
  labels: string[];
}) {
  const w = 400;
  const h = 160;
  const max = Math.max(atual, apos, 1);
  const bw = 80;
  const x1 = 100;
  const x2 = 240;
  const h1 = (atual / max) * (h - 48);
  const h2 = (apos / max) * (h - 48);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md">
      <rect x={x1 - bw / 2} y={h - 40 - h1} width={bw} height={h1} fill="rgba(59,130,246,0.7)" rx={6} />
      <rect x={x2 - bw / 2} y={h - 40 - h2} width={bw} height={h2} fill="rgba(34,211,238,0.75)" rx={6} />
      <text x={x1} y={h - 18} textAnchor="middle" className="fill-zinc-400 text-[10px]">
        {labels[0]}
      </text>
      <text x={x2} y={h - 18} textAnchor="middle" className="fill-zinc-400 text-[10px]">
        {labels[1]}
      </text>
    </svg>
  );
}
