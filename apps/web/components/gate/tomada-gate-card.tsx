"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  staffPatioTomadaConectar,
  staffPatioTomadaDesconectar,
  staffPatioTomadaStatus,
  type StaffPatioTomadaStatus,
} from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";

export function TomadaGateCard({
  unidadeIso,
  podeOperar = true,
  onChanged,
}: {
  unidadeIso: string;
  podeOperar?: boolean;
  onChanged?: () => void;
}) {
  const [status, setStatus] = useState<StaffPatioTomadaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [setPoint, setSetPoint] = useState("-18");
  const [ausente, setAusente] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const s = await staffPatioTomadaStatus(unidadeIso);
      setStatus(s);
      setAusente(false);
      const ultimo = s.eventos.find((e) => e.setPoint != null);
      if (ultimo?.setPoint != null) setSetPoint(String(ultimo.setPoint));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setStatus(null);
        setAusente(true);
      } else {
        toast.error(e instanceof ApiError ? e.message : "Falha ao ler status da tomada");
      }
    } finally {
      setLoading(false);
    }
  }, [unidadeIso]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function conectar() {
    const sp = Number(String(setPoint).replace(",", "."));
    if (Number.isNaN(sp) || sp < -30 || sp > 30) {
      toast.error("Informe um set point entre -30 e 30 °C");
      return;
    }
    setBusy(true);
    try {
      await staffPatioTomadaConectar(unidadeIso, { setPoint: sp });
      toast.success("Tomada conectada — diária de energia em vigor.");
      await carregar();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao conectar a tomada.");
    } finally {
      setBusy(false);
    }
  }

  async function desconectar() {
    setBusy(true);
    try {
      await staffPatioTomadaDesconectar(unidadeIso);
      toast.success("Tomada desconectada — o relógio de energia parou.");
      await carregar();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao desconectar a tomada.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-white/10 bg-[#0b101c]/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <PlugZap className="h-4 w-4 text-cyan-300" />
          Tomada reefer
        </CardTitle>
        <CardDescription className="text-zinc-500">
          A cobrança é por dias ligados, não pela baixa. Ligue aqui no Gate ou aceite o pedido do portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-zinc-200">
        {loading ? <div className="h-12 animate-pulse rounded-md bg-white/5" /> : null}

        {!loading && ausente && !podeOperar ? (
          <p className="text-zinc-500">Sem registro de pátio para esta unidade.</p>
        ) : null}

        {!loading && status?.conectada ? (
          <p className="text-emerald-300">Conectada — diária de energia em vigor.</p>
        ) : null}
        {!loading && status?.solicitacaoPendente ? (
          <p className="text-amber-300">Cliente pediu conexão no portal — falta ligar no pátio.</p>
        ) : null}
        {!loading && !status?.conectada && !status?.solicitacaoPendente && !ausente ? (
          <p className="text-zinc-400">Desconectada — sem cobrança de energia.</p>
        ) : null}
        {!loading && ausente && podeOperar ? (
          <p className="text-zinc-400">Ainda sem evento de tomada. Ligar registra o primeiro dia.</p>
        ) : null}

        {podeOperar && !loading ? (
          <div className="flex flex-wrap items-end gap-3">
            {!status?.conectada ? (
              <>
                <label className="w-28 space-y-1">
                  <span className="text-xs text-zinc-400">Set point (°C)</span>
                  <Input
                    value={setPoint}
                    onChange={(e) => setSetPoint(e.target.value)}
                    type="number"
                    step="0.1"
                    min={-30}
                    max={30}
                    className="border-zinc-600 bg-black/40 text-white"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  className="bg-cyan-700 hover:bg-cyan-600"
                  onClick={() => void conectar()}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                  Conectar tomada
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className="border-amber-500/40 text-amber-200"
                onClick={() => void desconectar()}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                Desconectar
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
