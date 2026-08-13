"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { getApiBase } from "@/lib/api/corporate-auth-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { cn } from "@/lib/utils";

type Health = {
  api: string;
  database: string;
  redis: string;
  queues: string;
  securityEngine: string;
  portal: string;
  timestamp: string;
};

type LatencyResp = {
  recent: Array<{ route: string; ms: number; status: number }>;
  aggregates: {
    avgMs: number;
    p95Ms: number;
    p99Ms: number;
    byRoute: Array<{ route: string; avgMs: number; p95Ms: number; p99Ms: number; count: number }>;
  };
};

type ErrorsResp = {
  items: Array<{ route: string; message: string; service: string; timestamp: string; level: string }>;
};

type ServicesResp = {
  ranking: Array<{ route: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  throughputPerMinute: Array<{ minute: string; count: number }>;
};

type SecurityResp = {
  eventosCriticos24h: number;
  inconsistenciaFingerprint24h: number;
  anomaliasDetectadas24h: number;
  quedasSessaoProxy: number;
  fingerprintsBloqueados: number;
  scoreAmbiente: number;
  porSeveridade: Record<string, number>;
};

type HeatmapResp = {
  routes: string[];
  hoursUtc: string[];
  matrix: number[][];
};

type ResilienceDashboard = {
  circuits: Record<string, { phase: string; consecutiveFailures: number; openedAt: number | null }>;
  openServices: string[];
  fallbackCountByService: Record<string, number>;
  circuitOpenStats: Record<string, { totalCooldownMs: number; opens: number; avgOpenMs: number }>;
  timeline: unknown[];
  recoveryLog: unknown[];
};

type WsLog = { type: string; payload: Record<string, unknown> };

function statusStyle(s: string): string {
  const v = (s || "").toLowerCase();
  if (v === "ok") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (v === "degraded" || v === "not_configured") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  if (v === "offline" || v === "fail" || v === "error") return "border-rose-500/50 bg-rose-500/10 text-rose-200";
  return "border-zinc-600 bg-zinc-800/60 text-zinc-300";
}

export default function StaffObservabilidadePage() {
  const role = useStaffAuthStore((s) => s.user?.role);
  const [health, setHealth] = useState<Health | null>(null);
  const [latency, setLatency] = useState<LatencyResp | null>(null);
  const [errors, setErrors] = useState<ErrorsResp | null>(null);
  const [services, setServices] = useState<ServicesResp | null>(null);
  const [security, setSecurity] = useState<SecurityResp | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResp | null>(null);
  const [resilience, setResilience] = useState<ResilienceDashboard | null>(null);
  const [liveTail, setLiveTail] = useState<string[]>([]);
  const [wsLines, setWsLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [h, l, e, sv, sec, hm, live, resi] = await Promise.all([
        staffJson<Health>("/admin/observability/health"),
        staffJson<LatencyResp>("/admin/observability/latency"),
        staffJson<ErrorsResp>("/admin/observability/errors"),
        staffJson<ServicesResp>("/admin/observability/services"),
        staffJson<SecurityResp>("/admin/observability/security"),
        staffJson<HeatmapResp>("/admin/observability/heatmap"),
        staffJson<{ items: Array<{ route: string; ms: number; status: number; at: string; method: string }> }>(
          "/admin/observability/live",
        ),
        staffJson<ResilienceDashboard>("/admin/observability/resilience"),
      ]);
      setHealth(h);
      setLatency(l);
      setErrors(e);
      setServices(sv);
      setSecurity(sec);
      setHeatmap(hm);
      setResilience(resi);
      setLiveTail(
        (live.items ?? []).slice(0, 100).map(
          (r) => `${r.at}  ${r.method} ${r.route}  ${r.status}  ${r.ms}ms`,
        ),
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar observabilidade";
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (role !== "ADMIN") return;
    const base = getApiBase();
    const socket: Socket = io(`${base}/ws/observability`, { transports: ["websocket"] });
    const push = (line: string) => {
      setWsLines((prev) => [line, ...prev].slice(0, 100));
    };
    const onLog = (evt: WsLog) => {
      const p = evt?.payload as {
        at?: string;
        method?: string;
        route?: string;
        status?: number;
        ms?: number;
      };
      push(
        `${p.at ?? new Date().toISOString()}  [LOG]  ${p.method ?? ""} ${p.route ?? ""}  ${p.status ?? ""}  ${p.ms ?? ""}ms`,
      );
    };
    const onErr = (evt: WsLog) => {
      const p = evt?.payload as { message?: string; route?: string; level?: string; timestamp?: string };
      push(`${p.timestamp ?? ""}  [${p.level ?? "ERROR"}]  ${p.route ?? ""}  ${p.message ?? ""}`);
    };
    const onHealth = (evt: WsLog) => {
      const p = (evt?.payload as Health) || (evt as unknown as Health);
      if (p && typeof p === "object" && "api" in p) {
        setHealth(p);
        push(`${p.timestamp}  [HEALTH]  api=${p.api} db=${p.database} redis=${p.redis} sec=${p.securityEngine}`);
      }
    };
    const onCircuit = (evt: WsLog) => {
      const p = evt?.payload as { service?: string; phase?: string; timestamp?: string };
      push(`${p.timestamp ?? ""}  [CIRCUIT] ${p.service ?? "?"} → ${p.phase ?? ""}`);
    };
    const onFb = (evt: WsLog) => {
      const p = evt?.payload as { service?: string; path?: string; timestamp?: string };
      push(`${p.timestamp ?? ""}  [FALLBACK] ${p.service ?? ""} ${p.path ?? ""}`);
    };
    const onRec = (evt: WsLog) => {
      const p = evt?.payload as { phase?: string; target?: string; timestamp?: string };
      push(`${p.timestamp ?? ""}  [RECOVERY] ${p.phase ?? ""} ${p.target ?? ""}`);
    };
    socket.on("LOG_EVENT", onLog);
    socket.on("ERROR_EVENT", onErr);
    socket.on("HEALTH_UPDATE", onHealth);
    socket.on("CIRCUIT_EVENT", onCircuit);
    socket.on("FALLBACK_EVENT", onFb);
    socket.on("RECOVERY_EVENT", onRec);
    return () => {
      socket.off("LOG_EVENT", onLog);
      socket.off("ERROR_EVENT", onErr);
      socket.off("HEALTH_UPDATE", onHealth);
      socket.off("CIRCUIT_EVENT", onCircuit);
      socket.off("FALLBACK_EVENT", onFb);
      socket.off("RECOVERY_EVENT", onRec);
      socket.disconnect();
    };
  }, [role]);

  const heatmapMax = useMemo(() => {
    if (!heatmap?.matrix.length) return 1;
    let m = 0;
    for (const row of heatmap.matrix) {
      for (const c of row) m = Math.max(m, c);
    }
    return m || 1;
  }, [heatmap]);

  if (role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center text-amber-200">
        <p className="text-sm font-semibold">Acesso negado</p>
        <p className="mt-2 text-sm text-zinc-400">O painel de observabilidade é exclusivo para perfil ADMIN.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Observabilidade</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Latência, saúde dos serviços, erros, throughput e telemetria em tempo quase real (Redis + WebSocket).
        </p>
      </div>

      {err ? (
        <p className="text-sm text-rose-400" role="alert">
          {err}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="border-zinc-600" onClick={() => void load()} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar agora"}
        </Button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Status geral</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {health
            ? (
                [
                  ["API", health.api],
                  ["Banco", health.database],
                  ["Redis", health.redis],
                  ["Security Engine", health.securityEngine],
                  ["Queue", health.queues],
                  ["Portal", health.portal],
                ] as const
              ).map(([label, st]) => (
                <div
                  key={label}
                  className={cn("rounded-xl border px-3 py-3 text-sm", statusStyle(st))}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
                  <p className="mt-1 font-mono text-xs">{st}</p>
                </div>
              ))
            : (
                <p className="text-zinc-500">Carregando…</p>
              )}
        </div>
      </section>

      <Card className="border-white/10 bg-[#0c101a]/90">
        <CardHeader>
          <CardTitle className="text-white">Latência por rota</CardTitle>
          <CardDescription className="text-zinc-400">
            Global: média {latency?.aggregates.avgMs ?? "—"} ms · P95 {latency?.aggregates.p95Ms ?? "—"} · P99{" "}
            {latency?.aggregates.p99Ms ?? "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(latency?.aggregates.byRoute ?? []).slice(0, 12).map((r) => {
              const w = Math.min(100, (r.p95Ms / 50) * 3);
              return (
                <div key={r.route} className="rounded-lg border border-white/5 bg-black/20 p-3">
                  <p className="truncate font-mono text-[11px] text-zinc-300" title={r.route}>
                    {r.route}
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded bg-zinc-800">
                    <div
                      className="h-full rounded bg-cyan-500/80"
                      style={{ width: `${Number.isFinite(w) ? w : 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    média {r.avgMs} ms · P95 {r.p95Ms} · n={r.count}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0c101a]/90">
          <CardHeader>
            <CardTitle className="text-white">Falhas por rota (24h)</CardTitle>
            <CardDescription className="text-zinc-400">Contagem por hora UTC (últimas 24 colunas).</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {heatmap && heatmap.routes.length > 0 ? (
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-[#0c101a] p-1 text-left font-normal text-zinc-500">Rota</th>
                    {heatmap.hoursUtc.map((h) => (
                      <th key={h} className="p-1 font-mono font-normal text-zinc-600">
                        {h.slice(-2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.routes.map((route, ri) => (
                    <tr key={route}>
                      <td className="sticky left-0 max-w-[140px] truncate bg-[#0c101a] p-1 font-mono text-zinc-400" title={route}>
                        {route}
                      </td>
                      {heatmap.matrix[ri]?.map((v, ci) => {
                        const intensity = heatmapMax ? v / heatmapMax : 0;
                        return (
                          <td key={`${route}-${ci}`} className="p-0.5">
                            <div
                              className="h-6 w-full min-w-[18px] rounded-sm"
                              style={{
                                backgroundColor: `rgba(239, 68, 68, ${0.15 + intensity * 0.85})`,
                              }}
                              title={`${v} falhas`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-zinc-500">Sem dados de falha no período (ou aguardando primeiros erros).</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0c101a]/90">
          <CardHeader>
            <CardTitle className="text-white">Últimos erros</CardTitle>
            <CardDescription className="text-zinc-400">Stack omitido em produção na API.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[360px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0c101a] text-zinc-500">
                <tr>
                  <th className="py-2 pr-2">Quando</th>
                  <th className="py-2 pr-2">Nível</th>
                  <th className="py-2 pr-2">Rota</th>
                  <th className="py-2">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {(errors?.items ?? []).map((e, i) => (
                  <tr key={`${e.timestamp}-${i}`} className="border-t border-white/5">
                    <td className="whitespace-nowrap py-2 pr-2 font-mono text-[10px] text-zinc-500">
                      {e.timestamp?.slice(11, 19)}
                    </td>
                    <td className="py-2 pr-2 text-rose-300">{e.level}</td>
                    <td className="max-w-[160px] truncate py-2 pr-2 font-mono text-zinc-400" title={e.route}>
                      {e.route}
                    </td>
                    <td className="py-2 text-zinc-300">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0c101a]/90">
          <CardHeader>
            <CardTitle className="text-white">Throughput (req/min)</CardTitle>
            <CardDescription className="text-zinc-400">Últimos 60 minutos, bucket UTC.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThroughputSpark data={services?.throughputPerMinute ?? []} />
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0c101a]/90">
          <CardHeader>
            <CardTitle className="text-white">Rotas com maior carga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {(services?.ranking ?? []).slice(0, 15).map((r) => (
              <div key={r.route} className="flex justify-between gap-2 border-b border-white/5 py-1 font-mono text-zinc-300">
                <span className="truncate">{r.route}</span>
                <span className="text-emerald-400">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#0c101a]/90">
        <CardHeader>
          <CardTitle className="text-white">Usuários mais ativos (amostra)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {(services?.topUsers ?? []).slice(0, 12).map((u) => (
            <div key={u.userId} className="flex justify-between gap-2 border-b border-white/5 py-1 font-mono text-zinc-300">
              <span className="truncate">{u.userId}</span>
              <span className="text-cyan-400">{u.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c101a]/90">
        <CardHeader>
          <CardTitle className="text-white">Security Engine</CardTitle>
          <CardDescription className="text-zinc-400">Resumo 24h e score de ambiente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Eventos CRÍTICOS (24h)" value={security?.eventosCriticos24h ?? "—"} />
          <Metric label="Alertas fingerprint (24h)" value={security?.inconsistenciaFingerprint24h ?? "—"} />
          <Metric label="Anomalias / alertas (24h)" value={security?.anomaliasDetectadas24h ?? "—"} />
          <Metric label="Logins falha (proxy queda)" value={security?.quedasSessaoProxy ?? "—"} />
          <Metric label="Fingerprints bloqueados" value={security?.fingerprintsBloqueados ?? "—"} />
          <Metric label="Score ambiente" value={security?.scoreAmbiente ?? "—"} />
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c101a]/90">
        <CardHeader>
          <CardTitle className="text-white">Resiliência (circuit breaker)</CardTitle>
          <CardDescription className="text-zinc-400">
            Circuitos, fallbacks e auto-recovery (GET /admin/observability/resilience).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase text-zinc-500">Abertos agora</p>
            <p className="font-mono text-amber-200">
              {(resilience?.openServices?.length ?? 0) === 0
                ? "Nenhum"
                : resilience?.openServices?.join(", ")}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {resilience?.circuits
              ? Object.entries(resilience.circuits).map(([k, v]) => (
                  <div key={k} className="rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-zinc-300">
                    <span className="text-zinc-500">{k}</span> · {v.phase}
                    {v.openedAt ? ` · opened ${new Date(v.openedAt).toLocaleTimeString()}` : ""}
                  </div>
                ))
              : null}
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Fallbacks (contagem Redis)</p>
            <div className="max-h-24 overflow-auto font-mono text-zinc-400">
              {resilience?.fallbackCountByService
                ? Object.entries(resilience.fallbackCountByService).map(([k, n]) => (
                    <div key={k} className="flex justify-between border-b border-white/5 py-0.5">
                      <span>{k}</span>
                      <span className="text-amber-300">{n}</span>
                    </div>
                  ))
                : "—"}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Timeline (amostra)</p>
            <pre className="max-h-40 overflow-auto rounded border border-white/5 bg-black/40 p-2 text-[10px] text-zinc-400">
              {(resilience?.timeline ?? [])
                .slice(0, 20)
                .map((t) => JSON.stringify(t))
                .join("\n") || "—"}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Recovery log</p>
            <pre className="max-h-32 overflow-auto rounded border border-white/5 bg-black/40 p-2 text-[10px] text-zinc-400">
              {(resilience?.recoveryLog ?? [])
                .slice(0, 15)
                .map((t) => JSON.stringify(t))
                .join("\n") || "—"}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c101a]/90">
        <CardHeader>
          <CardTitle className="text-white">Console ao vivo</CardTitle>
          <CardDescription className="text-zinc-400">
            Redis + WebSocket: LOG, ERROR, HEALTH, CIRCUIT, FALLBACK, RECOVERY.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[320px] overflow-auto rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[10px] leading-relaxed text-emerald-100/90">
            {[...wsLines, "--- snapshot redis ---", ...liveTail].slice(0, 120).join("\n")}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ThroughputSpark({
  data,
}: {
  data: Array<{ minute: string; count: number }>;
}) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);
  return (
    <div className="flex h-28 items-end gap-px">
      {data.map((d) => {
        const h = max ? (d.count / max) * 100 : 0;
        return (
          <div key={d.minute} className="group relative flex-1" title={`${d.minute}: ${d.count}`}>
            <div className="w-full rounded-t bg-gradient-to-t from-cyan-600/40 to-cyan-400/90" style={{ height: `${h}%` }} />
          </div>
        );
      })}
    </div>
  );
}
