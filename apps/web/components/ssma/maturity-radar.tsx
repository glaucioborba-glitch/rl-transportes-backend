"use client";

import { useEffect, useState } from "react";
import { ssmaStorage } from "@/lib/ssma/storage";

const DIMS = [
  { k: "disciplina", l: "Disciplina" },
  { k: "procedimentos", l: "Procedimentos" },
  { k: "reportabilidade", l: "Reportabilidade" },
  { k: "proatividade", l: "Proatividade" },
  { k: "consistencia", l: "Consistência" },
] as const;

export function MaturityRadar() {
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    setScores(ssmaStorage.maturity.getScores());
  }, []);

  const n = DIMS.length;
  const cx = 140;
  const cy = 140;
  const r = 90;
  const vals = DIMS.map((d) => Math.min(5, Math.max(1, scores[d.k] ?? 3)));

  function set(k: string, v: number) {
    const next = { ...scores, [k]: v };
    setScores(next);
    ssmaStorage.maturity.setScores(next);
  }

  const coords = vals.map((v, i) => {
    const a = (-Math.PI / 2 + (2 * Math.PI * i) / n);
    const rr = (v / 5) * r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  });
  const poly = coords.map(([x, y]) => `${x},${y}`).join(" ");

  const niveis = ["1 Reativa", "2 Dependente", "3 Independente", "4 Interdependente", "5 Excelência"];
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const nivel = niveis[Math.min(4, Math.max(0, Math.round(avg) - 1))] ?? niveis[2];

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col items-center">
        <svg width={280} height={280} viewBox="0 0 280 280">
          {[0.2, 0.4, 0.6, 0.8, 1].map((s) => (
            <polygon
              key={s}
              fill="none"
              stroke="rgba(245,158,11,0.2)"
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
          <polygon fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth={1.5} points={poly} />
          {DIMS.map((d, i) => {
            const a = (-Math.PI / 2 + (2 * Math.PI * i) / n);
            const x = cx + (r + 18) * Math.cos(a);
            const y = cy + (r + 18) * Math.sin(a);
            return (
              <text key={d.k} x={x} y={y} textAnchor="middle" className="fill-zinc-500 text-[8px]">
                {d.l}
              </text>
            );
          })}
        </svg>
        <p className="mt-2 text-center text-xs text-amber-200/90">{nivel}</p>
      </div>
      <div className="space-y-3 text-sm">
        {DIMS.map((d) => (
          <label key={d.k} className="block text-zinc-400">
            {d.l} (1–5)
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              className="mt-1 w-full accent-amber-600"
              value={scores[d.k] ?? 3}
              onChange={(e) => set(d.k, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
