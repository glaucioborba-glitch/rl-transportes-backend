"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
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
import { solicitacaoContainerPrimary, collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { ContainerNumber } from "@/components/ui/container-number";
import { ContainerExtraUnitsBadge } from "@/components/shared/operation-identity";
import { toast } from "@/lib/toast";
import { confirmarAcaoJanelaExecucao } from "@/utils/janelaExecucao";
import { usePessoaPermissoesStore } from "@/stores/pessoaPermissoesStore";
import { buildCredencialMotoristaData, exibeCredencialMotorista } from "@/lib/credencial-motorista";

function dataAgendamento(row: SolicitacaoRow): string {
  return row.agendamentoSolicitacao?.dataRef
    ? String(row.agendamentoSolicitacao.dataRef).slice(0, 10)
    : row.createdAt.slice(0, 10);
}

function statusPermiteCredencial(status: string): boolean {
  return (
    status === "APROVADO" ||
    status === "EM_TRANSITO" ||
    status === "EM_PATIO" ||
    status === "EM_EXECUCAO"
  );
}

function statusPermiteEdicao(status: string): boolean {
  return status === "PENDENTE" || status === "EM_ANALISE";
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
  const acoesDisponiveis = podeEditar && statusPermiteEdicao(row.status);
  const mostrarCredencial = statusPermiteCredencial(row.status) && exibeCredencialMotorista(row);
  const credencialData = useMemo(
    () => buildCredencialMotoristaData(credencialRow),
    [credencialRow],
  );
  const containerIsos = useMemo(() => collectSolicitacaoContainerISOs(row), [row]);
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
        <div className="flex items-start justify-between gap-3 p-4 pb-0" onClick={stopCardNav}>
          <div className="min-w-0">
            <p className="font-mono text-base font-semibold tracking-tight text-white">
              {solicitacaoProtocoloDisplay(row.protocolo)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(row.createdAt)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <StatusBadge status={row.status} />
            {mostrarCredencial || acoesDisponiveis ? (
              <div className="flex flex-wrap justify-end gap-2">
                {mostrarCredencial ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => void abrirCredencial()}
                  >
                    <QrCode className="mr-1 h-3.5 w-3.5" />
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
                      className="text-red-400 hover:text-red-300"
                      disabled={canceling}
                      onClick={() => void handleCancelar()}
                    >
                      {canceling ? "Cancelando…" : "Cancelar"}
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mb-3 mt-2 px-4 pb-1">
          {containerDefinido ? (
            <div className="flex flex-wrap items-center gap-2">
              <ContainerNumber value={containerIsos[0] ?? "—"} />
              {containerDisplay.extraCount > 0 ? (
                <ContainerExtraUnitsBadge extraCount={containerDisplay.extraCount} />
              ) : null}
            </div>
          ) : (
            <>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Contêiner</p>
              <p className="text-sm font-normal text-muted-foreground">A DEFINIR</p>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pt-2 md:grid-cols-4 md:gap-4">
          <CardField label="Solicitante" value={solicitacaoSolicitanteLabel(row)} />
          <CardField label="Booking" value={solicitacaoBookingLabel(row)} />
          <CardField label="Tipo / Tamanho" value={solicitacaoEquipamentoLabel(row)} />
          <CardField label="Transporte" value={solicitacaoTransporteLabel(row)} />
        </div>

        <div className="mt-2 flex justify-end px-4 pb-3" onClick={stopCardNav}>
          <Link
            href={detailHref}
            className="text-sm font-medium text-[var(--accent)] transition-colors hover:text-white"
          >
            Ver detalhes &gt;
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
