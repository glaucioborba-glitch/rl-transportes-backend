"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function cellColor(v: number, max: number) {
  const r = max > 0 ? v / max : 0;
  if (r < 0.33) return "bg-sky-900/80";
  if (r < 0.66) return "bg-amber-600/70";
  return "bg-red-700/80";
}

function IaBadge({ p }: { p: number }) {
  const tone = p < 0.2 ? "text-emerald-300" : p < 0.6 ? "text-amber-300" : "text-red-300";
  return (
    <span className={cn("tabular-nums font-bold", tone)}>{Math.round(p * 100)}%</span>
  );
}

export default function CockpitHeatmapPage() {
  const role = useStaffAuthStore((s) => s.user?.role ?? "");
  const isGestao = role === "ADMIN" || role === "GERENTE";

  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [cap, setCap] = useState<Record<string, unknown> | null>(null);
  const [gar, setGar] = useState<Record<string, unknown> | null>(null);
  const [patio, setPatio] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await staffJson<Record<string, unknown>>(`/dashboard-performance`);
      setPerf(p);
      const c = await staffJson<Record<string, unknown>>(`/simulador/capacidade`);
      setCap(c);
      if (isGestao) {
        try {
          setGar(await staffJson(`/ia/gargalos`));
        } catch {
          setGar(null);
        }
      }
      try {
        setPatio(await staffJson(`/ia/patio/recomendacoes`));
      } catch {
        setPatio(null);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro heatmap");
    }
  }, [isGestao]);

  useEffect(() => {
    void load();
  }, [load]);

  const mapa = ((perf?.produtividadeHumana as Record<string, unknown>)?.mapaCalorPorHora as {
    hora: number;
    total: number;
  }[]) ?? [];
  const maxH = Math.max(1, ...mapa.map((x) => x.total));

  const horizontes = (gar?.horizontes as { horas: number; probabilidadePortaria: number }[]) ?? [];
  const recs = (patio?.recomendacoes as { quadraOrigem: string; quadraDestino: string; motivo: string }[]) ?? [];

  const dias = 7;
  const matrix = Array.from({ length: dias }, (_, d) =>
    mapa.map((h) => ({
      d,
      h: h.hora,
      v: h.total,
    })),
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Heatmap operacional</h1>
      <p className="text-sm text-slate-500">
        Matriz derivada de `dashboard-performance.produtividadeHumana.mapaCalorPorHora` (replicada por dia no MVP
        visual) + IA onde o perfil permite.
      </p>

      <Card className="border-white/10 bg-[#0c1018]">
        <CardHeader>
          <CardTitle className="text-white">Pressão 24h × 7 (visual)</CardTitle>
          <CardDescription>Intensidade relativa ao pico do período</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="inline-block min-w-[720px]">
            <div className="mb-1 flex gap-px">
              <div className="w-8" />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-slate-600">
                  {h}h
                </div>
              ))}
            </div>
            {matrix.map((row, di) => (
              <div key={di} className="mb-px flex gap-px">
                <div className="flex w-8 items-center text-[10px] text-slate-500">D{di + 1}</div>
                {row.map((cell, i) => (
                  <div
                    key={`${di}-${i}`}
                    className={cn("h-4 flex-1 rounded-sm", cellColor(cell.v, maxH))}
                    title={`D${di + 1} ${cell.h}h: ${cell.v}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isGestao && horizontes.length ? (
        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader>
            <CardTitle className="text-white">Gargalos previstos (GET /ia/gargalos)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {horizontes.map((h) => (
              <div key={h.horas} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-sm font-medium text-white">Horizonte {h.horas}h</p>
                <p className="text-xs text-slate-500">
                  Portaria: <IaBadge p={h.probabilidadePortaria} />
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : !isGestao ? (
        <p className="text-sm text-slate-500">Previsões IA de gargalo: somente gestão (403 para operadores).</p>
      ) : null}

      <Card className="border-white/10 bg-[#0c1018]">
        <CardHeader>
          <CardTitle className="text-white">Balanceamento (GET /ia/patio/recomendacoes)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recs.length === 0 ? (
            <p className="text-sm text-slate-500">Sem recomendações ou sem permissão.</p>
          ) : (
            recs.map((r, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                <span className="text-[var(--accent)]">
                  {r.quadraOrigem} → {r.quadraDestino}
                </span>
                <p className="text-xs text-slate-400">{r.motivo}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c1018]">
        <CardHeader>
          <CardTitle className="text-white">Simulador capacidade</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto text-xs text-slate-500">{JSON.stringify(cap, null, 2)}</pre>
        </CardContent>
      </Card>
    </main>
  );
}
