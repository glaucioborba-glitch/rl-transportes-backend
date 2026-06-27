"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { io } from "socket.io-client";
import { getApiBase } from "@/lib/api/corporate-auth-client";
import {
  fetchPortalRiskProfile,
  portalRevogarOutrasSessoes,
} from "@/lib/api/portal-client";
import { usePortalHealth } from "@/hooks/use-portal-health";
import { usePortalAuthStore } from "@/stores/portal-store";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export function PortalSecurityBanner() {
  const user = usePortalAuthStore((s) => s.user);
  const health = usePortalHealth();
  const [risco, setRisco] = useState<number | null>(null);
  const [riskOk, setRiskOk] = useState(true);
  const lastBumpRef = useRef(0);

  const pollMs = health?.securityEngine === "degraded" ? 540_000 : 180_000;

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const p = await fetchPortalRiskProfile();
        if (!cancelled) {
          setRisco(p.riscoGlobal);
          setRiskOk(p.status !== "unable-to-evaluate" && p.status !== "unavailable");
        }
      } catch {
        if (!cancelled) {
          setRisco(null);
          setRiskOk(false);
        }
      }
    }
    void poll();
    const t = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pollMs]);

  useEffect(() => {
    const base = getApiBase();
    const uid = user?.id?.trim();
    if (!uid) return;
    const socket = io(`${base}/ws/security`, {
      transports: ["websocket", "polling"],
      query: { userId: uid },
    });
    const bump = () => {
      const now = Date.now();
      if (now - lastBumpRef.current < 5000) return;
      lastBumpRef.current = now;
      void fetchPortalRiskProfile()
        .then((p) => {
          setRisco(p.riscoGlobal);
          setRiskOk(p.status !== "unable-to-evaluate" && p.status !== "unavailable");
        })
        .catch(() => {
          setRisco(null);
          setRiskOk(false);
        });
    };
    socket.on("CRITICAL_EVENT", bump);
    socket.on("RISK_UPDATE", bump);
    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  async function encerrarTodas() {
    try {
      const r = await portalRevogarOutrasSessoes();
      toast.message(`${r.revogadas} sessão(ões) encerrada(s)`);
      const p = await fetchPortalRiskProfile();
      setRisco(p.riscoGlobal);
      setRiskOk(p.status !== "unable-to-evaluate" && p.status !== "unavailable");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao encerrar sessões");
    }
  }

  const showSevere = riskOk && risco !== null && risco >= 70;
  const showWarn = riskOk && risco !== null && risco >= 60 && risco < 70;

  if (!showSevere && !showWarn) return null;

  if (showSevere) {
    return (
      <div className="border-b border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p>
            <span className="mr-2">🔒</span>
            Alerta crítico de segurança — revise sessões e dispositivos imediatamente.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="border-red-400/50 text-red-100">
              <Link href="/portal/perfil/seguranca">Abrir segurança</Link>
            </Button>
            <Button size="sm" variant="outline" type="button" onClick={() => void encerrarTodas()} className="border-red-500/60 text-red-200">
              Encerrar todas as sessões
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p>
          <span className="mr-2">⚠️</span>
          Atividade incomum detectada na sua conta — revise seus dispositivos.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="border-amber-400/50 text-amber-50">
            <Link href="/portal/perfil/seguranca">Ver detalhes</Link>
          </Button>
          <Button size="sm" variant="outline" type="button" onClick={() => void encerrarTodas()} className="border-red-500/50 text-red-300">
            Encerrar todas as sessões
          </Button>
        </div>
      </div>
    </div>
  );
}
