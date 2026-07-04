"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CredencialMotoristaModal } from "@/components/portal/credencial-motorista-modal";
import { StatusBadge } from "@/components/portal/status-badge";
import { SolicitacaoEditModal } from "@/components/portal/solicitacao-edit-modal";
import {
  ApiError,
  cancelarSolicitacaoPortal,
  fetchSolicitacao,
  type SolicitacaoRow,
} from "@/lib/api/portal-client";
import {
  formatDateTime,
  solicitacaoBookingLabel,
  solicitacaoEquipamentoLabel,
  solicitacaoProtocoloDisplay,
  solicitacaoSolicitanteLabel,
  solicitacaoTransporteLabel,
} from "@/lib/portal-tracking";
import { solicitacaoContainerPrimary } from "@/lib/container-display";
import { ContainerExtraUnitsBadge } from "@/components/shared/operation-identity";
import { toast } from "@/lib/toast";
import { confirmarAcaoJanelaExecucao, isSolicitacaoTerminal } from "@/utils/janelaExecucao";
import { usePessoaPermissoesStore } from "@/stores/pessoaPermissoesStore";
import { buildCredencialMotoristaData, exibeCredencialMotorista } from "@/lib/credencial-motorista";

function dataAgendamento(row: SolicitacaoRow): string {
  return row.agendamentoSolicitacao?.dataRef
    ? String(row.agendamentoSolicitacao.dataRef).slice(0, 10)
    : row.createdAt.slice(0, 10);
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-slate-200" title={value}>
        {value}
      </p>
    </div>
  );
}

export function SolicitacaoCompactCard({
  row,
  onChanged,
}: {
  row: SolicitacaoRow;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const podeEditar = usePessoaPermissoesStore((s) => s.permissoes?.podeCriarSolicitacao ?? true);
  const [editOpen, setEditOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [credencialOpen, setCredencialOpen] = useState(false);
  const [credencialRow, setCredencialRow] = useState<SolicitacaoRow>(row);

  const detailHref = `/portal/solicitacoes/${row.id}`;
  const acoesDisponiveis = podeEditar && !isSolicitacaoTerminal(row.status);
  const mostrarCredencial = exibeCredencialMotorista(row);
  const credencialData = useMemo(
    () => buildCredencialMotoristaData(credencialRow),
    [credencialRow],
  );
  const containerDisplay = useMemo(() => solicitacaoContainerPrimary(row), [row]);
  const containerDefinido = containerDisplay.primary !== "—";

  async function abrirCredencial() {
    try {
      const full = await fetchSolicitacao(row.id);
      if (!buildCredencialMotoristaData(full)) {
        toast.error("Credencial indisponível para esta solicitação.");
        return;
      }
      setCredencialRow(full);
      setCredencialOpen(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar credencial");
    }
  }

  async function handleCancelar() {
    if (!confirmarAcaoJanelaExecucao(dataAgendamento(row), "cancelar")) return;

    setCanceling(true);
    try {
      await cancelarSolicitacaoPortal(row.id);
      toast.success("Solicitação cancelada.");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao cancelar");
    } finally {
      setCanceling(false);
    }
  }

  function stopCardNav(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <>
      <article
        role="link"
        tabIndex={0}
        onClick={() => router.push(detailHref)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(detailHref);
          }
        }}
        className="group cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-black/20 shadow-sm transition-colors hover:border-white/20 hover:bg-black/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-0">
          <div className="min-w-0">
            <p className="font-mono text-base font-semibold tracking-tight text-white">
              {solicitacaoProtocoloDisplay(row.protocolo)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(row.createdAt)}</p>
          </div>
          <StatusBadge status={row.status} />
        </div>

        <div className="px-4 pb-1 pt-3">
          <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Contêiner</p>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={
                containerDefinido
                  ? "font-mono text-xl font-bold tracking-wide text-[var(--accent)]"
                  : "text-sm font-normal text-muted-foreground"
              }
              title={containerDefinido ? containerDisplay.primary : undefined}
            >
              {containerDefinido ? containerDisplay.primary : "A DEFINIR"}
            </p>
            {containerDefinido && containerDisplay.extraCount > 0 ? (
              <ContainerExtraUnitsBadge extraCount={containerDisplay.extraCount} />
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 p-4 pt-2 md:grid-cols-4 md:gap-4">
          <CardField label="Solicitante" value={solicitacaoSolicitanteLabel(row)} />
          <CardField label="Booking" value={solicitacaoBookingLabel(row)} />
          <CardField label="Tipo / Tamanho" value={solicitacaoEquipamentoLabel(row)} />
          <CardField label="Transporte" value={solicitacaoTransporteLabel(row)} />
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3"
          onClick={stopCardNav}
        >
          <div className="flex flex-wrap items-center gap-2">
            {mostrarCredencial ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => void abrirCredencial()}
              >
                <QrCode className="h-4 w-4" />
                Credencial (QR Code)
              </Button>
            ) : null}
            {acoesDisponiveis ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={canceling}
                  onClick={() => void handleCancelar()}
                >
                  {canceling ? "Cancelando…" : "Cancelar"}
                </Button>
              </>
            ) : null}
          </div>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] transition-colors hover:text-white"
            onClick={stopCardNav}
          >
            Ver detalhes
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </article>

      <SolicitacaoEditModal
        open={editOpen}
        solicitacaoId={editOpen ? row.id : null}
        onClose={() => setEditOpen(false)}
        onUpdated={() => onChanged?.()}
      />

      <CredencialMotoristaModal
        open={credencialOpen}
        onClose={() => setCredencialOpen(false)}
        credencial={credencialOpen ? credencialData : null}
      />
    </>
  );
}
