"use client";

import { useMemo, useState } from "react";
import { ChevronDown, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CredencialMotoristaModal } from "@/components/portal/credencial-motorista-modal";
import { StatusBadge } from "@/components/portal/status-badge";
import { SolicitacaoDetailPanel } from "@/components/portal/solicitacao-detail-panel";
import { SolicitacaoEditModal } from "@/components/portal/solicitacao-edit-modal";
import {
  ApiError,
  cancelarSolicitacaoPortal,
  fetchSolicitacao,
  type SolicitacaoRow,
} from "@/lib/api/portal-client";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { OperationCardIdentity } from "@/components/shared/operation-identity";
import { formatDateTime, solicitacaoTipoLabel } from "@/lib/portal-tracking";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { confirmarAcaoJanelaExecucao, isSolicitacaoTerminal } from "@/utils/janelaExecucao";
import { usePessoaPermissoesStore } from "@/stores/pessoaPermissoesStore";
import { buildCredencialMotoristaData, exibeCredencialMotorista } from "@/lib/credencial-motorista";
import { PortalContainerTimelineSlideOver } from "@/components/portal/container-timeline-slideover";

function clienteLabel(row: SolicitacaoRow): string {
  return row.cliente?.nomeFantasia ?? row.cliente?.razaoSocial ?? "—";
}

function dataAgendamento(row: SolicitacaoRow): string {
  return row.agendamentoSolicitacao?.dataRef
    ? String(row.agendamentoSolicitacao.dataRef).slice(0, 10)
    : row.createdAt.slice(0, 10);
}

export function SolicitacaoCompactCard({
  row,
  onChanged,
}: {
  row: SolicitacaoRow;
  onChanged?: () => void;
}) {
  const podeEditar = usePessoaPermissoesStore((s) => s.permissoes?.podeCriarSolicitacao ?? true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [detail, setDetail] = useState<SolicitacaoRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [credencialOpen, setCredencialOpen] = useState(false);
  const [credencialRow, setCredencialRow] = useState<SolicitacaoRow>(row);
  const [timelineIso, setTimelineIso] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const acoesDisponiveis = podeEditar && !isSolicitacaoTerminal(row.status);
  const mostrarCredencial = exibeCredencialMotorista(row);
  const credencialData = useMemo(
    () => buildCredencialMotoristaData(credencialRow),
    [credencialRow],
  );

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

  async function toggleDetails() {
    const next = !isExpanded;
    setIsExpanded(next);
    if (!next || detail) return;

    setLoadingDetail(true);
    try {
      setDetail(await fetchSolicitacao(row.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar detalhes");
      setIsExpanded(false);
    } finally {
      setLoadingDetail(false);
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

  return (
    <>
      <article className="overflow-hidden rounded-lg border border-white/10 bg-black/20 shadow-sm transition-colors hover:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <OperationCardIdentity
              isos={collectSolicitacaoContainerISOs(row)}
              protocolo={row.protocolo}
              size="lg"
              onContainerClick={(iso) => {
                setTimelineIso(iso);
                setTimelineOpen(true);
              }}
            >
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={row.status} />
                <span className="truncate text-sm text-slate-400">
                  {clienteLabel(row)} · {solicitacaoTipoLabel(row)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.createdAt)}</p>
            </OperationCardIdentity>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1"
              onClick={() => void toggleDetails()}
              aria-expanded={isExpanded}
            >
              Ver detalhes
              <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
            </Button>
          </div>
        </div>

        {isExpanded ? (
          <div className="border-t border-white/10 bg-black/30 p-4">
            {loadingDetail ? (
              <Skeleton className="h-48 w-full" />
            ) : detail ? (
              <SolicitacaoDetailPanel row={detail} />
            ) : null}
          </div>
        ) : null}
      </article>

      <SolicitacaoEditModal
        open={editOpen}
        solicitacaoId={editOpen ? row.id : null}
        onClose={() => setEditOpen(false)}
        onUpdated={() => {
          setDetail(null);
          onChanged?.();
        }}
      />

      <CredencialMotoristaModal
        open={credencialOpen}
        onClose={() => setCredencialOpen(false)}
        credencial={credencialOpen ? credencialData : null}
      />

      <PortalContainerTimelineSlideOver
        iso={timelineIso}
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
      />
    </>
  );
}
