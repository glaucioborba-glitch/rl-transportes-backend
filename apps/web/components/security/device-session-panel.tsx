"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toast";

export type SessionRow = {
  sessionId: string;
  fingerprint: string;
  ip: string;
  geo: { cidade: string | null; estado: string | null; pais: string | null };
  userAgent: { navegador: string; so: string; device: string };
  inicioSessao: string;
  ultimoAcesso: string;
};

export type AuditRow = {
  id: string;
  fingerprint: string;
  ip: string;
  geo: { cidade: string | null; estado: string | null; pais: string | null };
  userAgent: { navegador: string; so: string; device: string };
  rota: string;
  metodo: string;
  deviceType: string | null;
  timestamp: string;
};

type Props = {
  title?: string;
  loadSessions: () => Promise<SessionRow[]>;
  loadAudit: () => Promise<AuditRow[]>;
  killSession: (sessionId: string) => Promise<void>;
  auditLimit?: number;
};

function deviceIcon(device: string): string {
  const d = device.toLowerCase();
  if (d.includes("tablet")) return "📲";
  if (d.includes("mobile") || d.includes("phone")) return "📱";
  return "🖥️";
}

function riskForAudit(a: AuditRow, prevCity: string | null): "low" | "med" | "high" {
  const city = a.geo.cidade;
  if (prevCity && city && prevCity !== city) return "high";
  return "low";
}

export function DeviceSessionPanel({
  title = "Dispositivos Conectados",
  loadSessions,
  loadAudit,
  killSession,
  auditLimit = 50,
}: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, au] = await Promise.all([loadSessions(), loadAudit()]);
      setSessions(s);
      setAudit(au.slice(0, auditLimit));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [loadSessions, loadAudit, auditLimit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => {
    const fps = new Set(sessions.map((x) => x.fingerprint));
    if (sessions.length >= 10) {
      return {
        level: "high" as const,
        text: "⚠️ Muitas sessões ativas ao mesmo tempo — revise e encerre as que não reconhece.",
      };
    }
    if (fps.size >= 3) {
      return {
        level: "med" as const,
        text: "⚠️ Vários dispositivos distintos em uso — confirme se são seus acessos.",
      };
    }
    return { level: "ok" as const, text: "🟢 Todas as sessões parecem seguras." };
  }, [sessions]);

  async function onKill(id: string) {
    setBusyId(id);
    try {
      await killSession(id);
      toast.message("Sessão encerrada");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao encerrar");
    } finally {
      setBusyId(null);
    }
  }

  const summaryColor =
    summary.level === "high"
      ? "#dc3545"
      : summary.level === "med"
        ? "#ffc107"
        : "#20c997";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm" style={{ borderColor: `${summaryColor}55` }}>
        <p style={{ color: summaryColor }}>{summary.text}</p>
      </div>

      <Card className="border-white/10 bg-[#0c0f14]/90">
        <CardHeader>
          <CardTitle className="text-white">{title}</CardTitle>
          <CardDescription className="text-slate-400">
            Sessões ativas no Redis e último contexto de auditoria por fingerprint.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-slate-500">Carregando…</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-slate-500">
                  <th className="pb-2 pr-2">Dispositivo</th>
                  <th className="pb-2 pr-2">Navegador / SO</th>
                  <th className="pb-2 pr-2">IP</th>
                  <th className="pb-2 pr-2">Cidade / UF</th>
                  <th className="pb-2 pr-2">Início</th>
                  <th className="pb-2 pr-2">Último acesso</th>
                  <th className="pb-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((row) => (
                  <tr key={row.sessionId} className="border-b border-white/5">
                    <td className="py-2 pr-2">
                      {deviceIcon(row.userAgent.device)}{" "}
                      <span className="text-white">{row.userAgent.device}</span>
                    </td>
                    <td className="py-2 pr-2">
                      {row.userAgent.navegador} / {row.userAgent.so}
                    </td>
                    <td className="font-mono text-xs py-2 pr-2">{row.ip}</td>
                    <td className="py-2 pr-2">
                      {[row.geo.cidade, row.geo.estado].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="py-2 pr-2 text-xs text-slate-400">
                      {new Date(row.inicioSessao).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-2 text-xs text-slate-400">
                      {new Date(row.ultimoAcesso).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                        disabled={busyId === row.sessionId}
                        onClick={() => void onKill(row.sessionId)}
                      >
                        Encerrar sessão
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0c0f14]/90">
          <CardHeader>
            <CardTitle className="text-base text-white">Histórico de acessos</CardTitle>
            <CardDescription className="text-slate-400">Últimas entradas registradas na auditoria.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-3 overflow-y-auto text-xs">
            {audit.map((a, i) => {
              const prevCity = i < audit.length - 1 ? audit[i + 1]?.geo?.cidade ?? null : null;
              const rk = riskForAudit(a, prevCity);
              const color = rk === "high" ? "#dc3545" : rk === "med" ? "#ffc107" : "#20c997";
              return (
                <div
                  key={a.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-3"
                  style={{ borderLeftWidth: 4, borderLeftColor: color }}
                >
                  <p className="font-mono text-slate-500">{new Date(a.timestamp).toLocaleString("pt-BR")}</p>
                  <p className="text-slate-200">
                    {a.userAgent.navegador} / {a.userAgent.so} · {a.ip}
                  </p>
                  <p className="text-slate-400">
                    {[a.geo.cidade, a.geo.estado].filter(Boolean).join(" / ") || "Geo indisponível"}
                  </p>
                  <p className="truncate text-slate-500">{a.metodo} {a.rota}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0c0f14]/90">
          <CardHeader>
            <CardTitle className="text-base text-white">Alertas de segurança</CardTitle>
            <CardDescription className="text-slate-400">
              Indicadores rápidos com base em sessões e auditoria recente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>
              <span className="text-[#ffc107]">•</span> Mudança de cidade entre acessos recentes aumenta o risco.
            </p>
            <p>
              <span className="text-[#dc3545]">•</span> Várias sessões simultâneas podem indicar uso compartilhado da conta.
            </p>
            <p>
              <span className="text-[#20c997]">•</span> Encerre sessões que não reconhece imediatamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
