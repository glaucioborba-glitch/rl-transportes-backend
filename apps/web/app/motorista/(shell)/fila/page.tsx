"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MobileHeader } from "@/components/motorista/mobile-header";
import { FilaCard } from "@/components/motorista/fila-card";
import { PositionIndicator } from "@/components/motorista/position-indicator";
import { EtaBadge } from "@/components/motorista/eta-badge";
import { MobileAlert } from "@/components/motorista/mobile-alert";
import { ApiError, motoristaFetchSolicitacao, motoristaJson } from "@/lib/api/motorista-client";
import { useMotoristaAuthStore } from "@/stores/motorista-auth-store";
import { canAccessDashboard } from "@/lib/motorista/permissions";
import { vibrateAlertPattern } from "@/lib/motorista/haptics";

type FilaItem = {
  solicitacaoId: string;
  protocolo: string;
  ordenadoPor: string;
  quantidadeUnidades: number;
};

type DashFilas = {
  filaPortaria: FilaItem[];
  filaGate: FilaItem[];
  filaPatio: FilaItem[];
  filaSaida: FilaItem[];
};

type Sla = {
  tempoMedioPortariaGate?: number | null;
  tempoMedioGatePatio?: number | null;
  tempoMedioPatioSaida?: number | null;
};

function readSid(): string | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("sid");
  if (p) return p;
  const raw = sessionStorage.getItem("rl_motorista_last_trip");
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { solicitacaoId?: string };
    return j.solicitacaoId ?? null;
  } catch {
    return null;
  }
}

function FilaInner() {
  const searchParams = useSearchParams();
  const user = useMotoristaAuthStore((s) => s.user);
  const sid = searchParams.get("sid") ?? readSid();
  const [sol, setSol] = useState<Record<string, unknown> | null>(null);
  const [dash, setDash] = useState<DashFilas | null>(null);
  const [sla, setSla] = useState<Sla | null>(null);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const lastCall = useRef<string | null>(null);

  const dashboardOk = canAccessDashboard(user);

  const load = useCallback(async () => {
    if (!sid) return;
    try {
      const s = await motoristaFetchSolicitacao(sid);
      setSol(s);
    } catch {
      setSol(null);
    }
    if (!dashboardOk) {
      setDash(null);
      setSla(null);
      return;
    }
    try {
      const d = await motoristaJson<{
        filas?: DashFilas;
        sla?: Sla;
      }>("/dashboard");
      setDash(d.filas ?? null);
      setSla(d.sla ?? null);
      setDashErr(null);
    } catch (e) {
      setDash(null);
      setDashErr(e instanceof ApiError ? e.message : "Dashboard indisponível");
    }
  }, [sid, dashboardOk]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  const stage = useMemo(() => {
    if (!sol) return null;
    const portaria = sol.portaria as Record<string, unknown> | null | undefined;
    const gate = sol.gate as Record<string, unknown> | null | undefined;
    const patio = sol.patio as Record<string, unknown> | null | undefined;
    const saida = sol.saida as Record<string, unknown> | null | undefined;
    if (!portaria) return "portaria" as const;
    if (!gate) return "gate" as const;
    if (!patio) return "patio" as const;
    if (!saida) return "saida" as const;
    return "done" as const;
  }, [sol]);

  const globalLabel = useMemo(() => {
    if (!stage) return "Carregando…";
    if (stage === "portaria") return "Aguardando portaria";
    if (stage === "gate") return "Aguardando gate";
    if (stage === "patio") {
      const quadra = (sol?.patio as { quadra?: string } | undefined)?.quadra;
      return quadra ? `No pátio — quadra ${quadra}` : "Aguardando pátio / movimentação";
    }
    if (stage === "saida") return "Aguardando saída (expedição)";
    return "Operação finalizada";
  }, [stage, sol]);

  const filaKey =
    stage === "portaria"
      ? "filaPortaria"
      : stage === "gate"
        ? "filaGate"
        : stage === "patio"
          ? "filaPatio"
          : stage === "saida"
            ? "filaSaida"
            : "filaPortaria";
  const activeFila = dash?.[filaKey] ?? [];
  const idx = sid ? activeFila.findIndex((x) => x.solicitacaoId === sid) : -1;
  const ahead = idx >= 0 ? idx : -1;
  const etaMin = useMemo(() => {
    if (ahead < 0) return null;
    const m =
      stage === "portaria"
        ? sla?.tempoMedioPortariaGate
        : stage === "gate"
          ? sla?.tempoMedioGatePatio
          : stage === "patio" || stage === "saida"
            ? sla?.tempoMedioPatioSaida
            : null;
    const base = typeof m === "number" && !Number.isNaN(m) ? m : 12;
    return Math.max(0, ahead * base);
  }, [ahead, stage, sla]);

  useEffect(() => {
    if (ahead === 0 && idx >= 0) {
      const sig = `${filaKey}-0`;
      if (lastCall.current !== sig) {
        lastCall.current = sig;
        vibrateAlertPattern();
      }
    }
  }, [ahead, idx, filaKey]);

  const quadra = (sol?.patio as { quadra?: string } | undefined)?.quadra;

  return (
    <>
      <MobileHeader title="Minha fila" />
      <main className="mx-auto max-w-lg space-y-4 px-3 pt-4">
        {!sid ? (
          <MobileAlert variant="warn" title="Sem operação ativa" body="Faça o check-in ou abra com ?sid=" />
        ) : null}

        {!dashboardOk ? (
          <MobileAlert
            variant="info"
            title="Somente tracking básico"
            body="Filas em tempo real exigem perfil operacional com /dashboard. Mostramos etapa pela solicitação."
          />
        ) : null}

        {dashErr && dashboardOk ? (
          <MobileAlert variant="warn" title="Fila ao vivo" body={dashErr} />
        ) : null}

        {sol ? (
          <FilaCard
            protocolo={String(sol.protocolo ?? "—")}
            statusLabel={globalLabel}
            subtitle={quadra ? `Quadra atual: ${quadra}` : undefined}
            highlight={ahead === 0 && idx >= 0}
          >
            <div className="mt-4 space-y-4">
              <PositionIndicator
                ahead={ahead < 0 ? 0 : ahead}
                totalInQueue={activeFila.length}
                inQueue={idx >= 0}
              />
              <EtaBadge minutes={etaMin} />
            </div>
          </FilaCard>
        ) : sid ? (
          <p className="text-slate-500">Carregando solicitação…</p>
        ) : null}

        {ahead === 0 && idx >= 0 ? (
          <MobileAlert variant="success" title="Sua vez de avançar!" body="Dirija-se conforme orientação do terminal." />
        ) : null}

        {stage === "gate" ? (
          <MobileAlert variant="info" title="Gate" body="Aguarde autorização para cruzar o portão." />
        ) : null}
      </main>
    </>
  );
}

export default function MotoristaFilaPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] bg-[#080a0d]" />}>
      <FilaInner />
    </Suspense>
  );
}
