"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, staffGateCheckOut, staffGatePreCheckOut } from "@/lib/api/staff-client";
import type { VistoriaAngulo } from "@/lib/gate-vistoria";
import { GateVistoriaWizard } from "@/components/gate/gate-vistoria-wizard";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { OperationPageHeader } from "@/components/shared/operation-identity";
import { toast } from "@/lib/toast";

export default function StaffGateCheckOutPage() {
  const { id: gateInId } = useParams<{ id: string }>();
  const router = useRouter();
  const [ctx, setCtx] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [divTipo, setDivTipo] = useState("LACRE_DIVERGENTE");
  const [divAntes, setDivAntes] = useState("");
  const [divDepois, setDivDepois] = useState("");
  const [divManual, setDivManual] = useState<{ tipo: string; antes?: string; depois?: string }[]>([]);

  const load = useCallback(async () => {
    if (!gateInId) return;
    setLoading(true);
    try {
      setCtx(await staffGatePreCheckOut(gateInId));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar check-out");
    } finally {
      setLoading(false);
    }
  }, [gateInId]);

  useEffect(() => {
    void load();
  }, [load]);

  const gateIn = ctx?.gateIn as Record<string, unknown> | undefined;
  const solicitacao = ctx?.solicitacao as Record<string, unknown> | undefined;
  const protocolo = solicitacao?.protocolo as string | undefined;

  async function onConfirm({
    fotos,
    avarias,
  }: {
    fotos: Record<VistoriaAngulo, File>;
    avarias: string[];
  }) {
    if (!gateInId) return;
    setBusy(true);
    try {
      await staffGateCheckOut(
        gateInId,
        {
          divergenciasOperador: divManual.length ? divManual : undefined,
          avarias: avarias.length ? avarias : undefined,
        },
        fotos,
      );
      toast.success("Check-out finalizado");
      router.push("/staff/gate");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha no check-out");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !ctx) {
    return (
      <div className="min-h-screen bg-[#050810] p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810]">
      <div className="border-b border-white/10 px-4 py-3">
        <OperationPageHeader
          isos={collectSolicitacaoContainerISOs({
            containersSolicitacao: solicitacao?.containersSolicitacao as
              | Array<{ unidade?: string; ordem?: number }>
              | undefined,
          })}
          protocolo={protocolo}
          eyebrow={
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/80">Gate check-out · PWA</p>
          }
          actions={
            <Button variant="outline" className="border-zinc-600" asChild>
              <Link href="/staff/gate">Fila</Link>
            </Button>
          }
        />
      </div>

      <GateVistoriaWizard
        titulo="Vistoria de saída"
        confirmLabel="Confirmar saída"
        busy={busy}
        onConfirm={onConfirm}
        conferencia={
          <>
            <p className="text-sm text-zinc-400">
              Cavalo na entrada:{" "}
              <span className="font-mono text-lg font-bold text-white">
                {gateIn ? String(gateIn.placaCavalo ?? "—") : "—"}
              </span>
            </p>
            <p className="text-xs text-zinc-500">
              Carreta 01:{" "}
              <span className="font-mono text-zinc-300">{gateIn ? String(gateIn.placaCarreta01 ?? "—") : "—"}</span>
            </p>
            <p className="text-xs text-zinc-500">
              Divergências na entrada: {gateIn ? JSON.stringify(gateIn.divergenciasJson ?? []) : "—"}
            </p>
            <p className="text-sm text-cyan-200/90">
              Confira verbalmente contêiner, lacre e placa antes de fotografar a saída.
            </p>
          </>
        }
        dadosGate={
          <div className="space-y-3">
            <p className="text-sm font-semibold text-amber-200">Divergências de saída</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={divTipo}
                onChange={(e) => setDivTipo(e.target.value)}
                className="min-h-12 rounded-md border border-zinc-600 bg-black/40 px-2 text-sm text-white"
              >
                <option value="LACRE_DIVERGENTE">Lacre divergente</option>
                <option value="CONTAINER_TROCADO">Container trocado</option>
                <option value="PLACA_DIVERGENTE">Placa divergente</option>
                <option value="OUTRA">Outra</option>
              </select>
              <Input
                placeholder="Antes"
                value={divAntes}
                onChange={(e) => setDivAntes(e.target.value)}
                className="min-h-12 border-zinc-600 bg-black/40 text-white"
              />
              <Input
                placeholder="Depois"
                value={divDepois}
                onChange={(e) => setDivDepois(e.target.value)}
                className="min-h-12 border-zinc-600 bg-black/40 text-white"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-amber-600/50 text-amber-100"
              onClick={() => {
                setDivManual((prev) => [
                  ...prev,
                  { tipo: divTipo, antes: divAntes.trim() || undefined, depois: divDepois.trim() || undefined },
                ]);
                setDivAntes("");
                setDivDepois("");
              }}
            >
              Adicionar divergência
            </Button>
            {divManual.length ? (
              <ul className="space-y-1 text-xs text-amber-100">
                {divManual.map((d, i) => (
                  <li key={i} className="rounded border border-amber-500/30 px-2 py-1">
                    {d.tipo}: {d.antes ?? "—"} → {d.depois ?? "—"}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
