"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Twin3DScene, type Twin3DLayers } from "@/components/digital-twin/twin-3d-scene";
import { useTwinTelemetry } from "@/lib/digital-twin/use-twin-telemetry";
import { mapQuadrasFromDashboard } from "@/lib/digital-twin/derive";
import { staffJson, staffTryJson, ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import type { MappedQuadra } from "@/lib/digital-twin/derive";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LAYERS: { key: keyof Twin3DLayers; label: string }[] = [
  { key: "trucks", label: "Fluxo caminhões" },
  { key: "heat", label: "Heatmap operacional" },
  { key: "iaRisk", label: "Gargalo IA" },
  { key: "future", label: "Saturação futura" },
  { key: "ocupacao", label: "Ocupação atual" },
];

export default function DigitalTwin3DPage() {
  const { bundle, refresh } = useTwinTelemetry(true);
  const [layers, setLayers] = useState<Twin3DLayers>({
    trucks: true,
    heat: true,
    iaRisk: true,
    future: true,
    ocupacao: true,
  });
  const [gar, setGar] = useState<{
    horizontes?: {
      horas: number;
      probabilidadePortaria: number;
      probabilidadeGate?: number;
      probabilidadePatio: number;
    }[];
  } | null>(null);
  const [selected, setSelected] = useState<MappedQuadra | null>(null);
  const [solDetail, setSolDetail] = useState<Record<string, unknown> | null>(null);

  const model = useMemo(() => {
    if (!bundle?.dash) return null;
    const dash = bundle.dash;
    const cap = bundle.cap;
    const filas = dash.filas as { filaPatio?: Array<{ quadra?: string; quantidadeUnidades?: number; ordenadoPor?: string; solicitacaoId?: string }> } | undefined;
    const sla = dash.sla as { idadeMediaEstadiaHoras?: number | null } | undefined;
    const qs = mapQuadrasFromDashboard({
      filaPatio: (Array.isArray(filas?.filaPatio) ? filas!.filaPatio! : []) as never[],
      quadrasDistintas: Number(cap?.quadrasDistintas ?? 6),
      slotsPorQuadraEstimado: Number(cap?.slotsPorQuadraEstimado ?? 40),
      idadeMediaEstadiaHoras: sla?.idadeMediaEstadiaHoras ?? null,
    });
    const sat = Number(cap?.fatorSaturacaoPct ?? 0);
    return { quadras: qs, sat, capTotal: Number(cap?.capacidadePatioSlotsTotal ?? 120) };
  }, [bundle]);

  const riskIntensity = useMemo(() => {
    const h = gar?.horizontes ?? [];
    if (!h.length) return 0.15;
    const m = Math.max(
      ...h.flatMap((x) => [x.probabilidadePortaria ?? 0, x.probabilidadeGate ?? 0, x.probabilidadePatio ?? 0]),
    );
    return Math.min(1, m);
  }, [gar]);

  const proj = bundle?.proj as { projecoes?: { dias: number; saturacaoPatioPrevistaPct: number }[] } | undefined;
  const p7 = proj?.projecoes?.find((x) => x.dias === 7);

  useEffect(() => {
    void (async () => {
      try {
        const g = await staffTryJson<typeof gar>(`/ia/gargalos`);
        setGar(g);
      } catch {
        setGar(null);
      }
    })();
  }, [bundle?.updatedAt]);

  const loadSol = useCallback(
    async (q: MappedQuadra) => {
      setSelected(q);
      const filas = bundle?.dash?.filas as { filaPatio?: { solicitacaoId?: string; quadra?: string }[] } | undefined;
      const row = filas?.filaPatio?.find((f) => (f.quadra ?? "") === q.label || (f.quadra ?? "") === q.id);
      const id = row?.solicitacaoId;
      if (!id) {
        setSolDetail(null);
        return;
      }
      try {
        const d = await staffJson<Record<string, unknown>>(`/solicitacoes/${id}`);
        setSolDetail(d);
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message);
        setSolDetail(null);
      }
    },
    [bundle?.dash],
  );

  function toggleLayer(k: keyof Twin3DLayers) {
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  if (!model) return <p className="text-zinc-500">Carregando cena 3D…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">Yard viewer 3D</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Cena data-driven: quadras com altura ∝ ocupação, fluxo de caminhões e halos de risco a partir de {` `}
            <code className="text-zinc-600">/ia/gargalos</code> (opcional). Clique numa quadra para inspeção.
          </p>
        </div>
        <Button type="button" variant="outline" className="border-cyan-500/35" onClick={() => void refresh()}>
          Sync
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {LAYERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleLayer(key)}
            className={cn(
              "rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-wide",
              layers[key] ? "border-cyan-400/50 bg-cyan-950/40 text-cyan-100" : "border-white/10 text-zinc-500",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Twin3DScene
        quadras={model.quadras}
        layers={layers}
        onPick={(q) => void loadSol(q)}
        riskIntensity={riskIntensity}
        projectionLabel={`Projeção D+7`}
        projectionSub={
          p7
            ? `Sat. prevista ${p7.saturacaoPatioPrevistaPct.toFixed(1)}% · conf. operacional`
            : "Sem projeção — verifique permissão em /simulador/projecao-saturacao"
        }
        capacityRef={model.capTotal}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#060a14] p-5">
          <p className="text-[10px] font-bold uppercase text-cyan-400/90">Modo inspeção</p>
          {selected ? (
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              <p>
                Quadra <span className="font-mono text-white">{selected.label}</span> · ocupação agregada {selected.ocupacao}
              </p>
              <p className="text-xs text-zinc-500">Dwell proxy: {selected.dwellProxyMin != null ? `${Math.round(selected.dwellProxyMin)} min` : "—"}</p>
              {solDetail ? (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-[10px] text-zinc-400">
                  {JSON.stringify(solDetail, null, 2).slice(0, 2800)}
                </pre>
              ) : (
                <p className="text-xs text-zinc-600">Sem solicitação explícita na fila para esta quadra.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">Selecione uma quadra na cena.</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#060a14] p-5">
          <p className="text-[10px] font-bold uppercase text-amber-300/90">Histórico 24h (proxy)</p>
          <p className="mt-2 text-xs text-zinc-500">
            Throughput e dwell finos vêm do dashboard de performance no módulo 2D; aqui exibimos apenas o snapshot atual da fila de pátio e o vínculo{" "}
            <code className="text-zinc-600">/solicitacoes/:id</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
