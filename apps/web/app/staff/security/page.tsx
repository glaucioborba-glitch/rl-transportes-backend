"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, staffJson, staffRequest } from "@/lib/api/staff-client";
import { getApiBase } from "@/lib/api/corporate-auth-client";
import { toast } from "@/lib/toast";

type SessaoRow = {
  userId?: string;
  sessionId?: string;
  device?: Record<string, unknown>;
  user?: { email?: string; cpfCnpj?: string } | null;
  clienteId?: string | null;
  riskScore?: number;
  perigosa?: boolean;
  ip?: unknown;
  lastSeenAt?: unknown;
};

type RiskMatrix = {
  topIps: Array<{ ip: string; count: number }>;
  fingerprintsBloqueados: number;
  usuariosMaisAlertas: Array<{ userId: string; count: number }>;
  rotasExploradas: Array<{ rota: string; count: number }>;
  porSeveridade: Record<string, number>;
  scoreAmbiente: number;
};

type HeatResp = {
  pontos: Array<{ lat: number; lon: number; peso?: number }>;
  celulas?: Array<{ lat: number; lon: number; densidade: number }>;
};

export default function StaffSecurityCenterPage() {
  const [sessoes, setSessoes] = useState<SessaoRow[]>([]);
  const [logins, setLogins] = useState<Record<string, unknown>[]>([]);
  const [heatmap, setHeatmap] = useState<HeatResp>({ pontos: [] });
  const [intrusoesFull, setIntrusoesFull] = useState<Record<string, unknown>[]>([]);
  const [riskMatrix, setRiskMatrix] = useState<RiskMatrix | null>(null);
  const [alertasAnom, setAlertasAnom] = useState<unknown[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socFlash, setSocFlash] = useState(false);
  const [filtroIntrusao, setFiltroIntrusao] = useState("");

  const intrusoesFiltradas = useMemo(() => {
    const q = filtroIntrusao.trim().toLowerCase();
    if (!q) return intrusoesFull;
    return intrusoesFull.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [filtroIntrusao, intrusoesFull]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [s, l, h, intr, mx, a] = await Promise.all([
        staffJson<SessaoRow[]>("/admin/security/sessoes"),
        staffJson<Record<string, unknown>[]>("/admin/security/logins"),
        staffJson<HeatResp>("/admin/security/heatmap"),
        staffJson<Record<string, unknown>[]>("/admin/security/intrusoes"),
        staffJson<RiskMatrix>("/admin/security/risk-matrix"),
        staffJson<{ alertas: unknown[]; metrics: Record<string, unknown> }>("/admin/security/anomalias"),
      ]);
      setSessoes(s);
      setLogins(l);
      setHeatmap(h);
      setIntrusoesFull(intr);
      setRiskMatrix(mx);
      setAlertasAnom(a.alertas ?? []);
      setMetrics(a.metrics ?? null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar Security Center";
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
    const base = getApiBase();
    const socket = io(`${base}/ws/security`, { transports: ["websocket"] });
    const onCrit = () => {
      setSocFlash(true);
      toast.error("Evento CRÍTICO — revisar intrusões");
      void load();
    };
    socket.on("CRITICAL_EVENT", onCrit);
    socket.on("RISK_UPDATE", () => void load());
    return () => {
      socket.off("CRITICAL_EVENT", onCrit);
      socket.disconnect();
    };
  }, [load]);

  async function derrubar(userId: string, sessionId: string) {
    try {
      const res = await staffRequest("/admin/security/acao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "expulsar_sessao", userId, sessionId }),
      });
      if (!res.ok) throw new ApiError(await res.text(), res.status);
      toast.message("Sessão encerrada");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro");
    }
  }

  async function bloquearFp(fp: string) {
    try {
      const res = await staffRequest("/admin/security/acao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "bloquear_dispositivo", fingerprint: fp }),
      });
      if (!res.ok) throw new ApiError(await res.text(), res.status);
      toast.message("Dispositivo bloqueado");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro");
    }
  }

  const porSev = riskMatrix?.porSeveridade ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Security Center (SOC)</h1>
          <p className="text-sm text-slate-400">
            Matriz de risco, sessões globais, intrusões e heatmap — tempo real via{" "}
            <code className="text-slate-500">/ws/security</code>.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {socFlash ? (
        <div className="rounded-lg border border-red-500/50 bg-red-950/50 px-4 py-3 text-sm text-red-100">
          Destaque SOC: evento crítico recebido — verifique a seção Intrusões.
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setSocFlash(false)}
          >
            dispensar
          </button>
        </div>
      ) : null}

      {err ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p>
      ) : null}

      {riskMatrix ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-white/10 bg-[#0c0f14]/90">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase text-slate-500">Score ambiente (7d)</CardDescription>
              <CardTitle className="text-2xl text-white">{riskMatrix.scoreAmbiente}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-white/10 bg-[#0c0f14]/90">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase text-slate-500">Fingerprints bloqueados</CardDescription>
              <CardTitle className="text-2xl text-white">{riskMatrix.fingerprintsBloqueados}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-white/10 bg-[#0c0f14]/90">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase text-slate-500">CRÍTICO</CardDescription>
              <CardTitle className="text-2xl text-rose-300">{porSev["CRÍTICO"] ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-white/10 bg-[#0c0f14]/90">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase text-slate-500">ALTO</CardDescription>
              <CardTitle className="text-2xl text-amber-300">{porSev["ALTO"] ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {riskMatrix ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-white/10 bg-[#0c0f14]/90 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base text-white">Top IPs</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[220px] space-y-1 overflow-y-auto font-mono text-xs text-slate-400">
              {riskMatrix.topIps.map((x) => (
                <div key={x.ip}>
                  {x.ip} · {x.count}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0c0f14]/90 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base text-white">Usuários com mais alertas</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[220px] space-y-1 overflow-y-auto font-mono text-xs text-slate-400">
              {riskMatrix.usuariosMaisAlertas.map((x) => (
                <div key={x.userId}>
                  {x.userId.slice(0, 10)}… · {x.count}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0c0f14]/90 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base text-white">Rotas exploradas</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[220px] space-y-1 overflow-y-auto font-mono text-xs text-slate-400">
              {riskMatrix.rotasExploradas.map((x) => (
                <div key={x.rota} className="truncate" title={x.rota}>
                  {x.rota} · {x.count}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(metrics).map(([k, v]) => (
            <Card key={k} className="border-white/10 bg-[#0c0f14]/90">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase text-slate-500">{k}</CardDescription>
                <CardTitle className="text-xl text-white">{String(v)}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="border-white/10 bg-[#0c0f14]/90">
        <CardHeader>
          <CardTitle className="text-white">Sessões ativas (globais)</CardTitle>
          <CardDescription className="text-slate-400">
            Redis — risco calculado; &gt;80 perigosa. Ações: encerrar ou bloquear fingerprint do device JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-slate-500">Carregando…</p>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-slate-500">
                  <th className="pb-2">Usuário</th>
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2">IP</th>
                  <th className="pb-2">Último</th>
                  <th className="pb-2">Risco</th>
                  <th className="pb-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sessoes.map((row, i) => {
                  const dev = row.device as Record<string, unknown> | undefined;
                  const fp = typeof dev?.fingerprint === "string" ? dev.fingerprint : "";
                  return (
                    <tr key={`${row.sessionId}-${i}`} className="border-b border-white/5">
                      <td className="py-2">
                        <span className="text-white">{row.user?.email ?? row.userId}</span>
                      </td>
                      <td className="font-mono text-xs">{String(row.clienteId ?? "—")}</td>
                      <td className="font-mono text-xs">{String(row.ip ?? "—")}</td>
                      <td className="text-xs text-slate-400">{String(row.lastSeenAt ?? "—")}</td>
                      <td>
                        <span className={row.perigosa ? "text-red-400" : ""}>
                          {String(row.riskScore ?? "—")}
                          {row.perigosa ? " ⚠" : ""}
                        </span>
                      </td>
                      <td className="space-x-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-red-500/40 text-red-300"
                          onClick={() =>
                            row.userId && row.sessionId ? void derrubar(row.userId, row.sessionId) : undefined
                          }
                        >
                          Encerrar
                        </Button>
                        {fp.length >= 16 ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => void bloquearFp(fp)}>
                            Bloquear FP
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0c0f14]/90">
          <CardHeader>
            <CardTitle className="text-base text-white">Tentativas de login</CardTitle>
            <CardDescription className="text-slate-500">Sucesso / falha, IP, fingerprint.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[360px] overflow-y-auto text-xs">
            {logins.slice(0, 120).map((r) => (
              <div key={String(r.id)} className="border-b border-white/5 py-2">
                <p className="text-slate-200">
                  {String(r.createdAt ?? "")} · {r.sucesso ? "OK" : "FALHA"}
                </p>
                <p className="font-mono text-slate-500">{String(r.ip ?? "")}</p>
                <p className="font-mono text-slate-600">{String(r.fingerprint ?? "").slice(0, 24)}…</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0c0f14]/90">
          <CardHeader>
            <CardTitle className="text-base text-white">Heatmap global</CardTitle>
            <CardDescription className="text-slate-400">
              {heatmap.pontos?.length ?? 0} pontos · {heatmap.celulas?.length ?? 0} células (densidade).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid max-h-[360px] grid-cols-2 gap-4 overflow-y-auto font-mono text-[11px] text-slate-400">
            <div>
              <p className="mb-2 text-slate-500">Células</p>
              {(heatmap.celulas ?? []).slice(0, 80).map((c, i) => (
                <div key={`${c.lat}-${c.lon}-${i}`}>
                  {c.lat.toFixed(2)}, {c.lon.toFixed(2)} · d={c.densidade}
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-slate-500">Amostra pontos</p>
              {(heatmap.pontos ?? []).slice(0, 80).map((p, i) => (
                <div key={`${p.lat}-${p.lon}-${i}`}>
                  {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#0c0f14]/90">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-white">Intrusões (alertas persistidos)</CardTitle>
            <CardDescription className="text-slate-400">Lista completa — filtre por texto.</CardDescription>
          </div>
          <input
            className="max-w-md rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600"
            placeholder="Filtrar…"
            value={filtroIntrusao}
            onChange={(e) => setFiltroIntrusao(e.target.value)}
          />
        </CardHeader>
        <CardContent className="max-h-[480px] space-y-2 overflow-y-auto text-xs text-slate-400">
          {intrusoesFiltradas.length === 0 ? <p>Nenhum registro.</p> : null}
          {intrusoesFiltradas.slice(0, 80).map((a, i) => (
            <pre key={i} className="overflow-x-auto rounded border border-white/10 bg-black/30 p-2">
              {JSON.stringify(a, null, 2)}
            </pre>
          ))}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c0f14]/90">
        <CardHeader>
          <CardTitle className="text-base text-white">Alertas (via /anomalias)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-400">
          {alertasAnom.length === 0 ? <p>Nenhum.</p> : null}
          {alertasAnom.slice(0, 30).map((a, i) => (
            <pre key={i} className="overflow-x-auto rounded border border-white/10 bg-black/30 p-2">
              {JSON.stringify(a, null, 2)}
            </pre>
          ))}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c0f14]/90">
        <CardHeader>
          <CardTitle className="text-base text-white">Bloquear fingerprint (manual)</CardTitle>
          <CardDescription className="text-slate-400">Hash SHA-256 do dispositivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const fp = String(fd.get("fp") ?? "").trim();
              if (fp.length >= 16) void bloquearFp(fp);
            }}
          >
            <input
              name="fp"
              className="min-w-[240px] flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white"
              placeholder="fingerprint SHA-256"
            />
            <Button type="submit" variant="outline" className="border-red-500/50 text-red-300">
              Bloquear dispositivo
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
