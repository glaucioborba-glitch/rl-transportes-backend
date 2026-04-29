"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function HeatBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function CockpitPage() {
  const role = useStaffAuthStore((s) => s.user?.role ?? "");
  const isGestao = role === "ADMIN" || role === "GERENTE";

  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [relOp, setRelOp] = useState<unknown>(null);
  const [relLista, setRelLista] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard`),
        staffJson<Record<string, unknown>>(`/dashboard-performance`),
      ]);
      setDash(d);
      setPerf(p);
      if (isGestao) {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 90);
        const di = start.toISOString().slice(0, 10);
        const df = end.toISOString().slice(0, 10);
        try {
          const r1 = await staffJson(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}`);
          setRelOp(r1);
        } catch {
          setRelOp(null);
        }
        try {
          const r2 = await staffJson(
            `/relatorios/operacional/solicitacoes/lista?page=1&limit=20&dataInicio=${di}&dataFim=${df}`,
          );
          setRelLista(r2);
        } catch {
          setRelLista(null);
        }
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha cockpit");
    }
  }, [isGestao]);

  useEffect(() => {
    void load();
  }, [load]);

  const snapshot = dash?.snapshot as Record<string, unknown> | undefined;
  const filas = dash?.filas as Record<string, unknown> | undefined;
  const conflitos = dash?.conflitos as Record<string, unknown> | undefined;
  const sla = dash?.sla as Record<string, unknown> | undefined;

  const est = perf?.estrategicos as { taxaGargaloDetectado?: boolean } | undefined;
  const gargalo = perf?.gargalos as Record<string, unknown> | undefined;
  const prodHum = perf?.produtividadeHumana as Record<string, unknown> | undefined;
  const mapaCalor = useMemo(
    () => (prodHum?.mapaCalorPorHora as { hora: number; total: number }[]) ?? [],
    [prodHum],
  );

  const maxHeat = useMemo(() => Math.max(1, ...mapaCalor.map((x) => x.total)), [mapaCalor]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Cockpit TOC / NOC</h1>
        <p className="text-sm text-slate-500">GET /dashboard + /dashboard-performance (+ relatórios se gestão)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Unidades no pátio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{Number(snapshot?.unidadesNoPatio ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Portaria / Gate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-white">
              {Number(snapshot?.unidadesEmPortaria ?? 0)} / {Number(snapshot?.unidadesEmGate ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Conflitos (bucket)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-300">{Number(conflitos?.gatesSemPortaria ?? 0)}</p>
            <p className="text-xs text-slate-500">gates sem portaria</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Gargalo (proxy)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-white">{est?.taxaGargaloDetectado ? "Sim" : "Não"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader>
            <CardTitle className="text-white">Filas</CardTitle>
            <CardDescription>Itens por etapa (dashboard)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["filaPortaria", "filaGate", "filaPatio", "filaSaida"] as const).map((k) => {
              const arr = (filas?.[k] as unknown[]) ?? [];
              const worst = arr.length ? String((arr[0] as { protocolo?: string }).protocolo ?? "—") : "—";
              return (
                <div key={k}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">{k.replace("fila", "")}</span>
                    <span className="tabular-nums text-slate-500">{arr.length} ops</span>
                  </div>
                  <p className="text-xs text-slate-600">Pior caso (1º): {worst}</p>
                  <HeatBar value={arr.length} max={40} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader>
            <CardTitle className="text-white">Telemetria operadores (24h)</CardTitle>
            <CardDescription>INSERT/UPDATE em etapas operacionais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {((filas?.operacoesAtivasPorOperador as { email?: string; operacoes24h?: number }[]) ?? []).map(
              (o, i) => (
                <div key={o.email ?? `op-${i}`} className="flex justify-between text-sm">
                  <span className="truncate text-slate-300">{o.email ?? "—"}</span>
                  <span className="tabular-nums text-slate-500">{o.operacoes24h ?? 0}</span>
                </div>
              ),
            )}
            <div className="pt-4">
              <p className="mb-2 text-xs text-slate-500">Histograma horário (performance)</p>
              <div className="flex h-24 items-end gap-px">
                {mapaCalor.map((h) => (
                  <div
                    key={h.hora}
                    className="flex-1 rounded-t bg-[var(--accent)]/80"
                    style={{ height: `${Math.max(8, (h.total / maxHeat) * 100)}%` }}
                    title={`${h.hora}h: ${h.total}`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#0c1018]">
        <CardHeader>
          <CardTitle className="text-white">SLA (período aplicado)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-48 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-slate-400">
            {JSON.stringify(sla ?? {}, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {isGestao && (relOp || relLista) ? (
        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader>
            <CardTitle className="text-white">Relatórios (gestão)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <pre className="max-h-56 overflow-auto rounded-lg bg-black/50 p-3 text-[10px] text-slate-500">
              {JSON.stringify(relOp ?? {}, null, 2)}
            </pre>
            <pre className="max-h-56 overflow-auto rounded-lg bg-black/50 p-3 text-[10px] text-slate-500">
              {JSON.stringify(relLista ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {gargalo ? (
        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader>
            <CardTitle className="text-white">Pressão de filas (performance)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-48 overflow-auto text-xs text-slate-500">
              {JSON.stringify(gargalo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
