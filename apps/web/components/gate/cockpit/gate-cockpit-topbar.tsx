"use client";

import { Bell, Calendar, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GateTurno } from "@/lib/gate/gate-cockpit-types";
import { NotificationBadge } from "@/components/ui/notification-badge";
import { useGateCockpitContext } from "./gate-cockpit-context";

const TURNOS: GateTurno[] = ["TODOS", "T1", "T2", "T3"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function GateCockpitTopbar() {
  const {
    filters,
    setTurno,
    setBusca,
    setDataRef,
    setShowNotifs,
    data,
    lastSync,
    loading,
    refresh,
  } = useGateCockpitContext();

  const notificacoes = data?.notificacoes ?? [];

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#0a0d12]/90 px-4 py-3">
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
        {TURNOS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTurno(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              filters.turno === t ? "bg-sky-600 text-white" : "text-zinc-400 hover:text-white",
            )}
          >
            {t === "TODOS" ? "Todos" : t}
          </button>
        ))}
      </div>

      <div className="relative min-w-[200px] flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="h-9 border-white/10 bg-black/40 pl-9 text-sm text-white"
          placeholder="Buscar placa ou contêiner…"
          value={filters.busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
        <button
          type="button"
          onClick={() => setDataRef(todayIso())}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium",
            filters.dataRef === todayIso() ? "bg-white/15 text-white" : "text-zinc-500 hover:text-white",
          )}
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => setDataRef(tomorrowIso())}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium",
            filters.dataRef === tomorrowIso() ? "bg-white/15 text-white" : "text-zinc-500 hover:text-white",
          )}
        >
          Amanhã
        </button>
        <label className="relative flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:text-white">
          <Calendar className="h-3.5 w-3.5" />
          <input
            type="date"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={filters.dataRef}
            onChange={(e) => setDataRef(e.target.value)}
          />
          <span className="font-mono text-[11px]">
            {new Date(`${filters.dataRef}T12:00:00`).toLocaleDateString("pt-BR")}
          </span>
        </label>
      </div>

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative border-white/10"
          onClick={() => setShowNotifs((v) => !v)}
        >
          <Bell className="mr-2 h-4 w-4" />
          Alertas
          {notificacoes.length > 0 ? (
            <span className="ml-2">
              <NotificationBadge count={notificacoes.length} />
            </span>
          ) : null}
        </Button>
        {filters.showNotifs && notificacoes.length > 0 ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-white/10 bg-[#0c1018] p-2 shadow-xl">
            <ul className="max-h-64 space-y-1 overflow-auto text-xs">
              {notificacoes.map((n) => (
                <li key={n.id} className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-zinc-300">
                  <p className="font-medium text-white">{n.mensagem}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">{n.tipo}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-white/10"
        disabled={loading}
        onClick={() => void refresh()}
      >
        <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
        Atualizar
      </Button>

      {lastSync ? (
        <p className="text-[10px] text-zinc-600">
          Sync {new Date(lastSync).toLocaleTimeString("pt-BR")}
        </p>
      ) : null}
    </header>
  );
}
