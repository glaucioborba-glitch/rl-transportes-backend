"use client";

export function SaturacaoProjectionChart({
  atualPct,
  projecoes,
}: {
  atualPct: number;
  projecoes: { dias: number; saturacaoPatioPrevistaPct: number; confiancaPct: number }[];
}) {
  const w = 640;
  const h = 200;
  const pad = 40;
  const max = 100;
  const items = [{ label: "Hoje", pct: atualPct, conf: 100 }, ...projecoes.map((p) => ({ label: `${p.dias}d`, pct: p.saturacaoPatioPrevistaPct, conf: p.confiancaPct }))];
  const barW = (w - pad * 2) / items.length - 8;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[480px] w-full">
        {items.map((it, i) => {
          const x = pad + i * ((w - pad * 2) / items.length) + 4;
          const bh = ((h - pad * 2) * it.pct) / max;
          const y = h - pad - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} fill="url(#satGrad)" rx={4} opacity={0.85} />
              <text x={x + barW / 2} y={h - pad + 14} textAnchor="middle" className="fill-zinc-400 text-[10px]">
                {it.label}
              </text>
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-cyan-300 text-[11px] font-bold">
                {it.pct.toFixed(0)}%
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="satGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>
      </svg>
      <p className="mt-1 text-[11px] text-zinc-500">
        Barras de projeção usam confiança declarada pelo simulador; ocupação atual referencial ({atualPct.toFixed(1)}%).
      </p>
    </div>
  );
}
