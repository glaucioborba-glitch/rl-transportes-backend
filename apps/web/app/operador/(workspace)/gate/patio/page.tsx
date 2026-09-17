"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GatePatioPanel } from "@/components/gate/cockpit/gate-patio-panel";
import {
  ApiError,
  staffPatioInventario,
  staffPatioSaldoPdf,
  staffPatioSaldoXml,
  type StaffPatioInventario,
  type StaffPatioSaldoFiltro,
  type StaffPatioSaldoUnidade,
} from "@/lib/api/staff-client";
import type { GatePatioUnidade } from "@/lib/gate/gate-cockpit-types";
import { GATE_POLLING_INTERVAL_MS, GATE_WEBSOCKET_ENABLED } from "@/lib/dev-performance";
import { useRealtimeSocket } from "@/lib/realtime/use-realtime-socket";
import { toast } from "@/lib/toast";

function diasEntre(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function mapUnidade(u: StaffPatioSaldoUnidade): GatePatioUnidade {
  return {
    stack: u.baia ?? "—",
    posicao: u.baia ?? "—",
    unidadeId: u.id,
    container: u.unidadeIso,
    tipo: u.refrigerado ? "Reefer" : "Dry",
    status: u.status,
    refrigerado: u.refrigerado,
    cliente: u.cliente,
    entradaEm: u.entradaEm,
    diasNoPatio: diasEntre(u.entradaEm),
    processoNumero: u.processoNumero,
    processo: u.processo ?? "",
    booking: u.booking ?? "",
    navio: u.navio ?? "",
    situacao: u.situacao ?? "",
    tamanho: u.tamanho ?? "",
    tamanhoLabel: u.tamanhoLabel ?? "",
    tipoContainer: u.tipoContainer ?? null,
    tomadaReefer: Boolean(u.tomadaReefer),
  };
}

function flattenBaias(inv: StaffPatioInventario): StaffPatioSaldoUnidade[] {
  return inv.baias.flatMap((baia) =>
    baia.unidades.map((u) => ({
      id: u.id,
      unidadeIso: u.unidadeIso,
      status: u.status,
      refrigerado: u.refrigerado,
      cliente: u.cliente,
      baia: baia.codigoBaia,
      entradaEm: u.entradaEm ?? new Date().toISOString(),
      processoNumero: null,
    })),
  );
}

function mapInventario(inv: StaffPatioInventario): {
  ocupados: number;
  capacidade: number;
  reefers: number;
  semBaia: number;
  unidades: GatePatioUnidade[];
} {
  const raw = inv.unidades?.length || inv.semBaia != null ? (inv.unidades ?? []) : flattenBaias(inv);
  const unidades = raw.map(mapUnidade);
  return {
    ocupados: inv.lotacaoTotal,
    capacidade: inv.capacidadeTotal,
    reefers: inv.reefersLigados,
    semBaia: inv.semBaia ?? unidades.filter((u) => u.posicao === "—").length,
    unidades,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GatePatioPage() {
  const [inv, setInv] = useState<StaffPatioInventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setInv(await staffPatioInventario());
    } catch (e) {
      if (!silent) {
        toast.error(e instanceof ApiError ? e.message : "Falha ao carregar o saldo de unidades.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), GATE_POLLING_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useRealtimeSocket({
    namespace: "/ws/yard",
    event: "yard_updated",
    onEvent: () => void load(true),
    enabled: GATE_WEBSOCKET_ENABLED,
  });

  const mapped = inv ? mapInventario(inv) : null;

  async function exportar(kind: "pdf" | "xml", filtro: StaffPatioSaldoFiltro) {
    setExporting(true);
    try {
      const blob =
        kind === "pdf" ? await staffPatioSaldoPdf(filtro) : await staffPatioSaldoXml(filtro);
      downloadBlob(blob, `saldo-unidades-${stamp()}.${kind}`);
      toast.success(kind === "pdf" ? "PDF gerado." : "XML gerado.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao gerar o relatório.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Saldo de Unidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle do que está armazenado no terminal. Baia é opcional.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      {loading && !mapped ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : mapped ? (
        <GatePatioPanel
          ocupados={mapped.ocupados}
          capacidade={mapped.capacidade}
          reefers={mapped.reefers}
          semBaia={mapped.semBaia}
          unidades={mapped.unidades}
          exporting={exporting}
          onExportPdf={(filtro) => void exportar("pdf", filtro)}
          onExportXml={(filtro) => void exportar("xml", filtro)}
          onTomadaChanged={() => void load(true)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Não foi possível carregar o saldo de unidades.</p>
      )}
    </div>
  );
}
