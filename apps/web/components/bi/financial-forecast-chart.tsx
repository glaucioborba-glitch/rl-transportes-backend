"use client";

export function FinancialForecastChart({
  meses,
  receita,
  inadimplenciaAcum,
}: {
  meses: string[];
  receita: number[];
  inadimplenciaAcum: number[];
}) {
  const w = 720;
  const h = 220;
  const pad = 36;
  const n = Math.max(receita.length, inadimplenciaAcum.length, meses.length, 1);
  const maxR = Math.max(...receita, 1);
  const maxI = Math.max(...inadimplenciaAcum, 1);
  const xAt = (i: number) => pad + (i / Math.max(n - 1, 1)) * (w - pad * 2);
  const yR = (v: number) => pad + (1 - v / maxR) * (h - pad * 2);
  const yI = (v: number) => pad + (1 - v / maxI) * (h - pad * 2);
  const lineR = receita.map((v, i) => `${xAt(i)},${yR(v)}`).join(" ");
  const areaI = inadimplenciaAcum
    .map((v, i) => `${xAt(i)},${yI(v)}`)
    .concat(`${xAt(n - 1)},${h - pad}`, `${pad},${h - pad}`)
    .join(" ");
  const step = Math.max(1, Math.ceil(n / 8));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[560px] w-full">
        <polygon fill="rgba(248,113,113,0.15)" stroke="rgba(248,113,113,0.5)" strokeWidth={1} points={areaI} />
        <polyline fill="none" stroke="#34d399" strokeWidth={2} points={lineR} />
        {meses.map((m, i) =>
          i % step === 0 ? (
            <text key={i} x={xAt(i)} y={h - 6} textAnchor="middle" className="fill-zinc-500 text-[9px]">
              {m.length > 7 ? m.slice(2) : m}
            </text>
          ) : null,
        )}
        <text x={w - pad} y={16} className="fill-emerald-400 text-[10px]">
          Receita
        </text>
        <text x={w - pad} y={28} className="fill-red-300/90 text-[10px]">
          Inad. acum.
        </text>
      </svg>
    </div>
  );
}
