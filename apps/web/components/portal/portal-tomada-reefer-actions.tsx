"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  fetchPortalTomadaStatus,
  solicitarTomadaPortal,
  type PortalTomadaStatus,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";

const EM_PATIO = new Set([
  "EM_PATIO",
  "AGUARDANDO_GATE_OUT",
  "APROVADO",
  "AGUARDANDO_GATE_IN",
]);

export function PortalTomadaReeferActions({
  unidadeIso,
  solicitacaoStatus,
  tipoCodigo,
}: {
  unidadeIso: string;
  solicitacaoStatus: string;
  tipoCodigo?: string | null;
}) {
  const podeTomada =
    Boolean(tipoCodigo?.toUpperCase().includes("REEFER")) && EM_PATIO.has(solicitacaoStatus);
  const [status, setStatus] = useState<PortalTomadaStatus | null>(null);
  const [setPoint, setSetPoint] = useState("-18");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!podeTomada || !unidadeIso) return;
    let cancelled = false;
    setLoading(true);
    void fetchPortalTomadaStatus(unidadeIso)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [podeTomada, unidadeIso]);

  if (!podeTomada) return null;

  async function onSolicitar() {
    const sp = Number(String(setPoint).replace(",", "."));
    if (Number.isNaN(sp) || sp < -30 || sp > 30) {
      toast.error("Informe um set point entre -30 e 30 °C");
      return;
    }
    setBusy(true);
    try {
      const res = await solicitarTomadaPortal(unidadeIso, { setPoint: sp });
      toast.success(res.message);
      setStatus(await fetchPortalTomadaStatus(unidadeIso));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao solicitar tomada");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-cyan-300/90">Tomada reefer</p>
      {loading ? (
        <p className="mt-1 text-xs text-slate-500">Carregando status…</p>
      ) : status?.conectada ? (
        <p className="mt-1 text-sm text-emerald-300">Conectada — diária de energia em vigor.</p>
      ) : status?.solicitacaoPendente ? (
        <p className="mt-1 text-sm text-amber-300">Pedido enviado — aguardando conexão no pátio.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Set point (°C)</label>
            <Input
              className="h-9 w-24 bg-black/40"
              type="number"
              step="0.1"
              min={-30}
              max={30}
              value={setPoint}
              onChange={(e) => setSetPoint(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" disabled={busy} onClick={() => void onSolicitar()}>
            Solicitar conexão
          </Button>
        </div>
      )}
    </div>
  );
}
