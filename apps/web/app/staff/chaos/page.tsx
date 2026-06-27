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

type ChaosStatus = {
  chaos: Record<string, unknown>;
  circuits: Record<string, { phase: string; consecutiveFailures: number; openedAt: number | null }>;
  openServices: string[];
};

type WsLog = { type: string; payload: Record<string, unknown> };

const LAT_OPTS = [200, 500, 1500, 5000] as const;

export default function StaffChaosPage() {
  const role = useStaffAuthStore((s) => s.user?.role);
  const [status, setStatus] = useState<ChaosStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [latMs, setLatMs] = useState<(typeof LAT_OPTS)[number]>(500);
  const [latTargets, setLatTargets] = useState<Array<"security" | "agendamentos" | "solicitacoes">>(["security"]);
  const [blockPath, setBlockPath] = useState("/cliente/security");
  const [blockStatus, setBlockStatus] = useState<503 | 504>(503);
  const [lines, setLines] = useState<string[]>([]);

  const push = useCallback((line: string) => {
    setLines((prev) => [line, ...prev].slice(0, 120));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await staffJson<ChaosStatus>("/admin/chaos/status");
      setStatus(s);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar status";
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
    const onChaos = (evt: WsLog) => {
      const p = evt?.payload ?? {};
      push(`${(p.at as string) ?? new Date().toISOString()}  [${evt.type}]  ${JSON.stringify(p)}`);
    };
    socket.on("CHAOS_TRIGGERED", onChaos);
    socket.on("CHAOS_RECOVERY", onChaos);
    socket.on("CHAOS_ERROR", onChaos);
    socket.on("CHAOS_FINISHED", onChaos);
    socket.on("CIRCUIT_EVENT", (evt: WsLog) => {
      const p = evt?.payload as { service?: string; phase?: string; timestamp?: string };
      push(`${p.timestamp ?? ""}  [CIRCUIT] ${p.service ?? "?"} → ${p.phase ?? ""}`);
    });
    socket.on("FALLBACK_EVENT", (evt: WsLog) => {
      const p = evt?.payload as { service?: string; path?: string; timestamp?: string };
      push(`${p.timestamp ?? ""}  [FALLBACK] ${p.service ?? ""} ${p.path ?? ""}`);
    });
    socket.on("RECOVERY_EVENT", (evt: WsLog) => {
      const p = evt?.payload as { phase?: string; target?: string; timestamp?: string };
      push(`${p.timestamp ?? ""}  [RECOVERY] ${p.phase ?? ""} ${p.target ?? ""}`);
    });
    return () => {
      socket.off("CHAOS_TRIGGERED", onChaos);
      socket.off("CHAOS_RECOVERY", onChaos);
      socket.off("CHAOS_ERROR", onChaos);
      socket.off("CHAOS_FINISHED", onChaos);
      socket.disconnect();
    };
  }, [role, push]);

  const run = async (key: string, path: string, body?: unknown) => {
    setBusy(key);
    try {
      await staffJson(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      toast.success("Chaos acionado");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha");
    } finally {
      setBusy(null);
    }
  };

  const engineAllowed = status?.chaos?.engineAllowed === true;

  const summary = useMemo(() => {
    if (!status) return null;
    return {
      open: status.openServices ?? [],
      dbRem: Number(status.chaos?.dbActiveMsRemaining ?? 0),
      redisRem: Number(status.chaos?.redisFreezeMsRemaining ?? 0),
    };
  }, [status]);

  if (role !== "ADMIN") {
    return (
      <div className="p-6 text-center text-amber-400">
        Chaos Monkey RL é exclusivo de <strong>ADMIN</strong>.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 text-zinc-100">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chaos Monkey RL</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Testes de resiliência controlados (DEV/QA). TTL máximo 30s. Auditoria e security_alerts em cada ação.
        </p>
      </div>

      {!engineAllowed && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-amber-200">Motor desligado neste ambiente</CardTitle>
            <CardDescription className="text-amber-100/80">
              Use NODE_ENV=development, DEPLOY_ENV=qa/homolog ou CHAOS_ENGINE_ENABLED=1.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Atualizar status
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-lg">Indicadores</CardTitle>
            <CardDescription>Circuitos e sabotagens ativas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {loading && <p className="text-zinc-500">Carregando…</p>}
            {summary && (
              <>
                <p>
                  <span className="text-zinc-500">Circuitos abertos:</span>{" "}
                  <span className={cn(summary.open.length ? "text-rose-300" : "text-emerald-300")}>
                    {summary.open.length ? summary.open.join(", ") : "nenhum"}
                  </span>
                </p>
                <p>
                  <span className="text-zinc-500">DB sintético (ms rest.):</span> {summary.dbRem}
                </p>
                <p>
                  <span className="text-zinc-500">Redis congelado (ms rest.):</span> {summary.redisRem}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-lg">Painel de testes</CardTitle>
            <CardDescription>Ações POST /admin/chaos/*</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button disabled={!engineAllowed || busy !== null} onClick={() => void run("db", "/admin/chaos/falha-db", { ms: 2000 })}>
              {busy === "db" ? "…" : "Derrubar DB (2s)"}
            </Button>
            <Button disabled={!engineAllowed || busy !== null} onClick={() => void run("redis", "/admin/chaos/falha-redis", { ms: 2000 })}>
              {busy === "redis" ? "…" : "Congelar Redis (2s)"}
            </Button>
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-2">
              <span className="text-xs text-zinc-500">Latência</span>
              <select
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                value={latMs}
                onChange={(e) => setLatMs(Number(e.target.value) as (typeof LAT_OPTS)[number])}
              >
                {LAT_OPTS.map((n) => (
                  <option key={n} value={n}>
                    +{n}ms
                  </option>
                ))}
              </select>
              {(["security", "agendamentos", "solicitacoes"] as const).map((t) => (
                <label key={t} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={latTargets.includes(t)}
                    onChange={() =>
                      setLatTargets((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
                    }
                  />
                  {t}
                </label>
              ))}
              <Button
                size="sm"
                disabled={!engineAllowed || busy !== null || latTargets.length === 0}
                onClick={() => void run("lat", "/admin/chaos/latencia", { ms: latMs, targets: latTargets, durationMs: 12000 })}
              >
                Injetar latência
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-2">
              <label className="flex flex-col text-xs text-zinc-500">
                Prefixo
                <input
                  className="mt-1 w-56 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                  value={blockPath}
                  onChange={(e) => setBlockPath(e.target.value)}
                />
              </label>
              <select
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                value={blockStatus}
                onChange={(e) => setBlockStatus(Number(e.target.value) as 503 | 504)}
              >
                <option value={503}>503</option>
                <option value={504}>504</option>
              </select>
              <Button
                size="sm"
                disabled={!engineAllowed || busy !== null}
                onClick={() => void run("blk", "/admin/chaos/bloqueio-rota", { pathPrefix: blockPath, status: blockStatus, durationMs: 8000 })}
              >
                Bloquear rota
              </Button>
            </div>
            <Button
              variant="default"
              className="bg-rose-700 hover:bg-rose-600"
              disabled={!engineAllowed || busy !== null}
              onClick={() => void run("tur", "/admin/chaos/turbulencia", { durationMs: 10000 })}
            >
              {busy === "tur" ? "…" : "Ativar turbulência (10s)"}
            </Button>
            <Button variant="outline" disabled={!engineAllowed || busy !== null} onClick={() => void run("rst", "/admin/chaos/reset", {})}>
              {busy === "rst" ? "…" : "Reset total"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/80">
        <CardHeader>
          <CardTitle className="text-lg">Telemetria em tempo real</CardTitle>
          <CardDescription>WebSocket /ws/observability — CHAOS_*, CIRCUIT, FALLBACK, RECOVERY</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[420px] overflow-auto rounded-lg border border-zinc-800 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
            {lines.length ? lines.join("\n") : "Aguardando eventos…"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
