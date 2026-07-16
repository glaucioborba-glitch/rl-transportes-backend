"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataField } from "@/components/ui/data-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  staffAprovarSolicitacaoV2,
  staffFetchSolicitacaoV2Detalhe,
  staffRejeitarSolicitacaoV2,
} from "@/lib/api/staff-client";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { podeAprovarOs } from "@/lib/gate/gate-cockpit-permissions";
import type { GateContainerSituacao } from "@/lib/gate/gate-cockpit-types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContainerNumber } from "@/components/ui/container-number";
import { useGateCockpitContext } from "./gate-cockpit-context";

type Props = {
  id: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("pt-BR");
}

function SituacaoBadge({ situacao }: { situacao: GateContainerSituacao }) {
  const cheio = situacao === "CHEIO";
  return (
    <Badge
      variant="neutral"
      className={cn(
        "text-xs",
        cheio
          ? "border-green-500/30 bg-green-500/15 text-green-400"
          : "border-zinc-500/30 bg-zinc-500/15 text-zinc-400",
      )}
    >
      {cheio ? "Cheio" : "Vazio"}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
      <p className="text-lg text-muted-foreground">Solicitação não encontrada.</p>
      <Button variant="outline" asChild>
        <Link href="/operador/gate/autorizacoes">Voltar para Autorizações</Link>
      </Button>
    </div>
  );
}

export function GateAutorizacaoDetalhePanel({ id }: Props) {
  const router = useRouter();
  const { refresh } = useGateCockpitContext();
  const user = useStaffAuthStore((s) => s.user);
  const podeAutorizar = podeAprovarOs(user);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof staffFetchSolicitacaoV2Detalhe>> | null>(
    null,
  );
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await staffFetchSolicitacaoV2Detalhe(id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setData(null);
      } else {
        toast.error(e instanceof ApiError ? e.message : "Erro ao carregar solicitação");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function aprovar() {
    setBusy(true);
    try {
      await staffAprovarSolicitacaoV2(id);
      toast.success("Solicitação aprovada");
      void refresh(true);
      router.push("/operador/gate/autorizacoes");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao aprovar");
    } finally {
      setBusy(false);
    }
  }

  async function rejeitar() {
    if (!motivo.trim()) return;
    setBusy(true);
    try {
      await staffRejeitarSolicitacaoV2(id, motivo.trim());
      toast.success("Solicitação rejeitada");
      setRejeitarOpen(false);
      setMotivo("");
      void refresh(true);
      router.push("/operador/gate/autorizacoes");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao rejeitar");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  const sol = data?.solicitacao as Record<string, unknown> | undefined;
  if (!data || !sol) return <NotFoundState />;

  const containers = (sol.containersSolicitacao as Record<string, unknown>[] | undefined) ?? [];
  const cs = containers[0];
  const ts = sol.transporteSolicitacao as Record<string, unknown> | undefined;
  const ag = sol.agendamentoSolicitacao as Record<string, unknown> | undefined;
  const ct = sol.solicitanteContato as Record<string, unknown> | undefined;
  const cliente = sol.cliente as { razaoSocial?: string } | undefined;
  const anexos = (sol.anexosSolicitacao as Record<string, unknown>[] | undefined) ?? [];
  const isos = collectSolicitacaoContainerISOs({
    containersSolicitacao: containers as Array<{ unidade?: string; ordem?: number }>,
  });
  const situacao =
    cs?.status === "CHEIO" ? "CHEIO" : cs?.status === "VAZIO" ? "VAZIO" : null;
  const tipoTamanho =
    cs?.tipo && cs?.tamanho ? `${String(cs.tipo)} / ${String(cs.tamanho)}` : null;
  const status = String(sol.status ?? "");
  const canAct = podeAutorizar && (status === "PENDENTE" || status === "EM_ANALISE");

  return (
    <div className="space-y-6 pb-24">
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" asChild>
        <Link href="/operador/gate/autorizacoes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Autorizações
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{String(sol.protocolo ?? id)}</h1>
          <p className="text-sm text-muted-foreground">Criado em {formatDate(String(sol.createdAt ?? ""))}</p>
        </div>
        <Badge variant="neutral">{status.replace(/_/g, " ")}</Badge>
      </div>

      <Card className="border-white/10 bg-[#0b1018]/90 p-5">
        <CardContent className="p-0">
          <ContainerNumber value={isos[0] ?? String(cs?.unidade ?? "—")} size="lg" className="mb-2" />
          <div className="flex flex-wrap items-center gap-3">
            {tipoTamanho ? <span className="text-sm text-muted-foreground">{tipoTamanho}</span> : null}
            {situacao ? <SituacaoBadge situacao={situacao} /> : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DataField label="Solicitante" value={ct?.nome != null ? String(ct.nome) : undefined} />
        <DataField label="Empresa" value={cliente?.razaoSocial} />
        <DataField label="Booking" value={cs?.booking != null ? String(cs.booking) : undefined} />
        <DataField
          label="Transporte"
          value={ts?.tipoCaminhao != null ? String(ts.tipoCaminhao) : undefined}
        />
        <DataField label="Motorista" value={ts?.nomeMotorista != null ? String(ts.nomeMotorista) : undefined} />
        <DataField label="CPF Motorista" value={ts?.cpfMotorista != null ? String(ts.cpfMotorista) : undefined} />
        <DataField label="Turno" value={ag?.turno != null ? String(ag.turno) : undefined} />
        <DataField
          label="Agendado para"
          value={
            ag?.dataRef != null
              ? formatDate(String(ag.dataRef))
              : ag?.data != null
                ? formatDate(String(ag.data))
                : undefined
          }
        />
      </div>

      {anexos.length > 0 ? (
        <Card className="border-white/10 bg-[#0b1018]/90 p-5">
          <CardContent className="p-0">
            <h2 className="mb-3 text-lg font-bold text-white">Documentos Anexados</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {anexos.map((anexo) => {
                const url = String(anexo.urlS3 ?? anexo.url ?? "");
                const nome = String(anexo.filename ?? "Documento");
                const content = (
                  <>
                    <FileText className="h-5 w-5 shrink-0 text-[var(--accent)]" />
                    <span className="truncate text-sm">{nome}</span>
                  </>
                );
                return url ? (
                  <a
                    key={String(anexo.id)}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border border-white/10 p-3 transition-colors hover:bg-white/5"
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={String(anexo.id)}
                    className="flex items-center gap-2 rounded-md border border-white/10 p-3"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t border-white/10 bg-[#080a0d]/95 p-4 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Voltar
        </Button>
        {canAct ? (
          <>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700"
              disabled={busy}
              onClick={() => void aprovar()}
            >
              <Check className="mr-2 h-4 w-4" />
              Aprovar Solicitação
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              disabled={busy}
              onClick={() => setRejeitarOpen(true)}
            >
              <X className="mr-2 h-4 w-4" />
              Rejeitar
            </Button>
          </>
        ) : null}
      </div>

      <Dialog open={rejeitarOpen} onOpenChange={setRejeitarOpen}>
        <DialogContent className="border-white/10 bg-[#0c1018] text-white">
          <DialogHeader>
            <DialogTitle>Rejeitar autorização</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-detalhe" className="text-sm text-muted-foreground">
              Motivo
            </Label>
            <Input
              id="motivo-detalhe"
              className="border-white/15 bg-black/40"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejeitarOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-rose-700 hover:bg-rose-600"
              disabled={busy || !motivo.trim()}
              onClick={() => void rejeitar()}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Extrai o ID da rota `/operador/gate/autorizacoes/[id]`. */
export function parseAutorizacaoDetalheId(pathname: string): string | null {
  const match = pathname.match(/\/operador\/gate\/autorizacoes\/([^/]+)$/);
  if (!match) return null;
  return match[1];
}
