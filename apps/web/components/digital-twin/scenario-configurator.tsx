"use client";

import { Button } from "@/components/ui/button";

export type ScenarioParams = {
  aumentoDemandaPercentual: number;
  reducaoTurnoHoras: number;
  aumentoTurnoHoras: number;
  expansaoQuadras: number;
  novoClienteVolumeEstimado: number;
  quadrasAdicionais: number;
  slotsPorQuadraEstimado: number;
  reducaoTurno: "" | "MANHA" | "TARDE" | "NOITE";
  aumentoTurno: "" | "MANHA" | "TARDE" | "NOITE";
};

const DEFAULT: ScenarioParams = {
  aumentoDemandaPercentual: 12,
  reducaoTurnoHoras: 0,
  aumentoTurnoHoras: 0,
  expansaoQuadras: 0,
  novoClienteVolumeEstimado: 0,
  quadrasAdicionais: 2,
  slotsPorQuadraEstimado: 40,
  reducaoTurno: "",
  aumentoTurno: "",
};

export function ScenarioConfigurator({
  value,
  onChange,
  onRun,
  onGenerateABC,
  loading,
}: {
  value: ScenarioParams;
  onChange: (v: ScenarioParams) => void;
  onRun: () => void;
  onGenerateABC: () => void;
  loading: boolean;
}) {
  function patch<K extends keyof ScenarioParams>(k: K, v: ScenarioParams[K]) {
    onChange({ ...value, [k]: v });
  }

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-[#070a14] p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/90">Configurador de cenário</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ["aumentoDemandaPercentual", "Demanda +%", "number"] as const,
            ["reducaoTurnoHoras", "Reduzir turno (h/dia)", "number"] as const,
            ["aumentoTurnoHoras", "Aumentar turno (h/dia)", "number"] as const,
            ["expansaoQuadras", "Quadras + (cenario)", "number"] as const,
            ["novoClienteVolumeEstimado", "Vol. novo cliente (un/mês)", "number"] as const,
            ["quadrasAdicionais", "Quadras + (expansão)", "number"] as const,
            ["slotsPorQuadraEstimado", "Slots/quadra (expansão)", "number"] as const,
          ] as const
        ).map(([key, lab, typ]) => (
          <label key={key} className="text-[10px] text-zinc-500">
            {lab}
            <input
              type={typ}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              value={value[key] as number}
              onChange={(e) => patch(key, Number(e.target.value) as never)}
            />
          </label>
        ))}
        <label className="text-[10px] text-zinc-500">
          Reduzir intensidade turno
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
            value={value.reducaoTurno}
            onChange={(e) => patch("reducaoTurno", e.target.value as ScenarioParams["reducaoTurno"])}
          >
            <option value="">—</option>
            <option value="MANHA">MANHA</option>
            <option value="TARDE">TARDE</option>
            <option value="NOITE">NOITE</option>
          </select>
        </label>
        <label className="text-[10px] text-zinc-500">
          Aumentar intensidade turno
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
            value={value.aumentoTurno}
            onChange={(e) => patch("aumentoTurno", e.target.value as ScenarioParams["aumentoTurno"])}
          >
            <option value="">—</option>
            <option value="MANHA">MANHA</option>
            <option value="TARDE">TARDE</option>
            <option value="NOITE">NOITE</option>
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" className="bg-violet-700 hover:bg-violet-600" disabled={loading} onClick={onRun}>
          {loading ? "Simulando…" : "Rodar simulação"}
        </Button>
        <Button type="button" variant="outline" className="border-violet-500/40" disabled={loading} onClick={onGenerateABC}>
          Gerar A / B / C
        </Button>
        <Button type="button" variant="ghost" className="text-zinc-500" onClick={() => onChange({ ...DEFAULT })}>
          Reset
        </Button>
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">
        Parâmetros espelham o DTO de <code className="text-zinc-500">GET /simulador/cenario</code> e{" "}
        <code className="text-zinc-500">GET /simulador/expansao</code>.
      </p>
    </div>
  );
}

export const scenarioDefaults = DEFAULT;
