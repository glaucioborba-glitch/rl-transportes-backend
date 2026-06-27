"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiError,
  fetchPortalGeoRecentes,
  fetchPortalIntrusoes,
  fetchPortalRiskProfile,
  fetchPortalSecuritySessoes,
  portalEncerrarSessao,
  portalRevogarOutrasSessoes,
  type PortalRiskProfileResponse,
} from "@/lib/api/portal-client";
import { getApiBase } from "@/lib/api/corporate-auth-client";
import { toast } from "@/lib/toast";
import { usePortalAuthStore } from "@/stores/portal-store";
import { usePortalHealth } from "@/hooks/use-portal-health";

function seloBadge(sel: PortalRiskProfileResponse["fingerprintSelo"]) {
  if (sel === "confiavel") return <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300">Confiável</span>;
  if (sel === "novo") return <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-200">Novo dispositivo</span>;
  return <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-300">Suspeito</span>;
}

export default function PortalSegurancaPage() {
  const user = usePortalAuthStore((s) => s.user);
  const health = usePortalHealth();
  const secOffline = health?.securityEngine === "offline";
  const [profile, setProfile] = useState<PortalRiskProfileResponse | null>(null);
  const [intrusoes, setIntrusoes] = useState<Record<string, unknown>[]>([]);
  const [sessoes, setSessoes] = useState<Record<string, unknown>[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lon: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const lastSocketRefresh = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      if (secOffline) {
        const [p] = await Promise.all([fetchPortalRiskProfile()]);
        setProfile(p);
        setIntrusoes([]);
        setSessoes([]);
        setGeo([]);
        return;
      }
      const [p, i, s, g] = await Promise.all([
        fetchPortalRiskProfile(),
        fetchPortalIntrusoes(),
        fetchPortalSecuritySessoes(),
        fetchPortalGeoRecentes(),
      ]);
      setProfile(p);
      setIntrusoes(i as Record<string, unknown>[]);
      setSessoes(s as Record<string, unknown>[]);
      setGeo(g.pontos ?? []);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar segurança";
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [secOffline]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const base = getApiBase();
    const uid = user?.id?.trim();
    const socket = io(`${base}/ws/security`, {
      transports: ["websocket"],
      query: uid ? { userId: uid } : {},
    });
    socket.on("CRITICAL_EVENT", () => {
      const n = Date.now();
      if (n - lastSocketRefresh.current < 5000) return;
      lastSocketRefresh.current = n;
      void load();
    });
    socket.on("RISK_UPDATE", () => {
      const n = Date.now();
      if (n - lastSocketRefresh.current < 5000) return;
      lastSocketRefresh.current = n;
      void load();
    });
    return () => {
      socket.disconnect();
    };
  }, [user?.id, load]);

  async function revogarOutras() {
    try {
      const r = await portalRevogarOutrasSessoes();
      toast.message(`${r.revogadas} sessão(ões) encerrada(s)`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : "Erro");
    }
  }

  async function encerrarUma(sid: string) {
    try {
      await portalEncerrarSessao(sid);
      toast.message("Sessão encerrada");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : "Erro");
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Segurança da conta</h1>
          <p className="text-sm text-slate-400">Intrusões, sessões e mapa de acessos recentes.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            Atualizar
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/portal/perfil">Voltar ao perfil</Link>
          </Button>
        </div>
      </div>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      {profile ? (
        <Card className="border-white/10 bg-[#0c0f14]/90">
          <CardHeader>
            <CardTitle className="text-white">Resumo de risco</CardTitle>
            <CardDescription className="text-slate-400">{profile.recomendacao}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Risco global</p>
              <p className="text-3xl font-semibold text-white">{profile.riscoGlobal ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Dispositivo atual</p>
              <p className="break-all font-mono text-xs text-slate-300">{profile.fingerprintAtual}</p>
              <div className="mt-2">{seloBadge(profile.fingerprintSelo)}</div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-white/10 bg-[#0c0f14]/90">
        <CardHeader>
          <CardTitle className="text-white">Intrusões detectadas</CardTitle>
          <CardDescription className="text-slate-400">Alertas alto risco (CRÍTICO / ALTO) para sua empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {intrusoes.length === 0 ? (
            <p className="text-slate-500">Nenhuma intrusão registrada.</p>
          ) : (
            intrusoes.map((a, idx) => (
              <pre
                key={String((a as { id?: string }).id ?? idx)}
                className="overflow-x-auto rounded border border-white/10 bg-black/30 p-3 text-xs text-slate-400"
              >
                {JSON.stringify(a, null, 2)}
              </pre>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c0f14]/90">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-white">Sessões ativas</CardTitle>
            <CardDescription className="text-slate-400">
              Score &gt; 80 marca a sessão como perigosa; o motor pode encerrar sessões &gt; 90.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void revogarOutras()} className="border-red-500/50 text-red-300">
            Encerrar todas as outras
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase text-slate-500">
                <th className="pb-2">Sessão</th>
                <th className="pb-2">Risco</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {sessoes.map((row) => {
                const sid = String(row.sessionId ?? "");
                const rs = row.riskScore as number | undefined;
                const perigosa = !!row.perigosa;
                return (
                  <tr key={sid} className="border-b border-white/5">
                    <td className="py-2 font-mono text-xs">{sid.slice(0, 12)}…</td>
                    <td>{rs ?? "—"}</td>
                    <td>{perigosa ? <span className="text-red-400">Perigosa</span> : <span className="text-slate-500">Normal</span>}</td>
                    <td>
                      <Button type="button" size="sm" variant="outline" onClick={() => void encerrarUma(sid)}>
                        Encerrar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c0f14]/90">
        <CardHeader>
          <CardTitle className="text-white">Mapa de acessos (mini)</CardTitle>
          <CardDescription className="text-slate-400">Últimas 50 coordenadas da auditoria (usuários do cliente).</CardDescription>
        </CardHeader>
        <CardContent className="grid max-h-[280px] gap-1 overflow-y-auto font-mono text-xs text-slate-400">
          {geo.length === 0 ? <p className="text-slate-500">Sem coordenadas recentes.</p> : null}
          {geo.slice(0, 50).map((p, i) => (
            <div key={`${p.lat}-${p.lon}-${i}`}>
              {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
