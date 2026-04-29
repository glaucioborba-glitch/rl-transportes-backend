"use client";

import type { IshikawaBranches } from "@/lib/ssma/types";

export function IshikawaDiagram({ data, onChange }: { data: IshikawaBranches; onChange: (d: IshikawaBranches) => void }) {
  const set = (k: keyof IshikawaBranches, v: string) => onChange({ ...data, [k]: v });

  const branches: { key: keyof IshikawaBranches; label: string; angle: number }[] = [
    { key: "metodo", label: "Método", angle: -150 },
    { key: "maquina", label: "Máquina", angle: -110 },
    { key: "material", label: "Material", angle: -70 },
    { key: "maoObra", label: "Mão de obra", angle: 70 },
    { key: "meioAmbiente", label: "Meio ambiente", angle: 110 },
    { key: "medicao", label: "Medição", angle: 150 },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 520 280" className="min-w-[480px] w-full text-[10px]">
          <line x1="40" y1="140" x2="420" y2="140" stroke="#92400e" strokeWidth={3} />
          <polygon points="420,140 400,130 400,150" fill="#f59e0b" />
          <text x="430" y="145" className="fill-amber-200 font-bold">
            Efeito
          </text>
          {branches.map((b) => {
            const rad = (b.angle * Math.PI) / 180;
            const x2 = 240 + Math.cos(rad) * 120;
            const y2 = 140 + Math.sin(rad) * 90;
            return (
              <g key={b.key}>
                <line x1="240" y1="140" x2={x2} y2={y2} stroke="#78716c" strokeWidth={2} />
                <text x={x2 + (Math.cos(rad) > 0 ? 6 : -6)} y={y2} textAnchor={Math.cos(rad) > 0 ? "start" : "end"} className="fill-zinc-400">
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="space-y-2 text-xs">
        {branches.map((b) => (
          <label key={b.key} className="block text-zinc-500">
            {b.label}
            <input
              className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
              value={data[b.key]}
              onChange={(e) => set(b.key, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
