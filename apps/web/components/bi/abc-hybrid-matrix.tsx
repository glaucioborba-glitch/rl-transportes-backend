"use client";

export type AbcBubble = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  classe: "A" | "B" | "C";
};

export function AbcHybridMatrix({ bubbles }: { bubbles: AbcBubble[] }) {
  const w = 560;
  const h = 300;
  const pad = 48;
  const maxX = Math.max(...bubbles.map((b) => b.x), 1);
  const maxY = Math.max(...bubbles.map((b) => b.y), 1);
  const maxS = Math.max(...bubbles.map((b) => b.size), 1);
  const color = (c: AbcBubble["classe"]) =>
    c === "A" ? "#34d399" : c === "B" ? "#fbbf24" : "#f87171";
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[480px] w-full">
        <text x={w / 2} y={h - 8} textAnchor="middle" className="fill-zinc-500 text-[10px]">
          Margem / lucro relativo →
        </text>
        <text x={12} y={h / 2} className="fill-zinc-500 text-[10px]" transform={`rotate(-90 12 ${h / 2})`}>
          Intensidade operacional →
        </text>
        {bubbles.map((b) => {
          const x = pad + (b.x / maxX) * (w - pad * 2);
          const y = h - pad - (b.y / maxY) * (h - pad * 2);
          const r = 6 + (b.size / maxS) * 18;
          return <circle key={b.id} cx={x} cy={y} r={r} fill={color(b.classe)} fillOpacity={0.75} stroke="#fff" strokeOpacity={0.2} />;
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-500">
        <span className="text-emerald-400">● Classe A</span>
        <span className="text-amber-400">● Classe B</span>
        <span className="text-red-400">● Classe C</span>
      </div>
    </div>
  );
}
