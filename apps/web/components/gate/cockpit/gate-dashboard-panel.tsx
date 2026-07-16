"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ApiError,
  staffAprovarSolicitacaoV2,
  staffGateDirecionarOperacao,
  staffRejeitarSolicitacaoV2,
} from "@/lib/api/staff-client";
import { podeAprovarOs } from "@/lib/gate/gate-cockpit-permissions";
import type { GateContainerSituacao } from "@/lib/gate/gate-cockpit-types";
import { formatChegada } from "@/lib/gate/gate-cockpit-utils";
import { cn } from "@/lib/utils";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useGateCockpitContext } from "./gate-cockpit-context";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetError } from "@/components/ui/widget-error";

const TURNO_FAIXA: Record<string, string> = {
  T1: "06:00–14:00",
  T2: "14:00–22:00",
  T3: "22:00–06:00",
};

import { ContainerNumber } from "@/components/ui/container-number";

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

function TipoTamanhoSituacao({
  tipoTamanho,
  situacao,
}: {
  tipoTamanho?: string | null;
  situacao?: GateContainerSituacao | null;
}) {
  if (!tipoTamanho) return null;
  return (
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{tipoTamanho}</span>
      {situacao ? <SituacaoBadge situacao={situacao} /> : null}
    </div>
  );
}

function DashboardListItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-b border-white/10 py-3 text-sm last:border-0", className)}>{children}</div>
  );
}

function Quadrant({
  title,
  subtitle,
  count,
  headerAction,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number | string | null;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[calc(50vh-70px)] flex-col rounded-lg border border-white/10 bg-[#0b1018]/90 p-5">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {count !== null && count !== undefined ? (
            <span className="text-3xl font-bold text-[var(--accent)]">{count}</span>
          ) : null}
          {headerAction}
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto">{children}</div>
    </div>
  );
}

function MiniResumoHeader({
  title,
  count,
  href,
}: {
  title: string;
  count: number;
  href: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span>{title}</span>
        {count > 0 ? (
          <Badge variant="neutral" className="text-xs">
            {count}
          </Badge>
        ) : null}
      </div>
      <Link href={href} className="text-xs text-muted-foreground hover:text-white">
        Ver todos
      </Link>
    </div>
  );
}

export function GateDashboardPanel() {
  const { data, loading, error, refresh } = useGateCockpitContext();
  const user = useStaffAuthStore((s) => s.user);
  const podeAutorizar = podeAprovarOs(user);
  const [rejeitarId, setRejeitarId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const dash = data?.dashboard;

  async function aprovar(id: string) {
    setBusy(true);
    try {
      await staffAprovarSolicitacaoV2(id);
      toast.success("Solicitação aprovada");
      void refresh(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao aprovar");
    } finally {
      setBusy(false);
    }
  }

  async function rejeitar() {
    if (!rejeitarId || !motivo.trim()) return;
    setBusy(true);
    try {
      await staffRejeitarSolicitacaoV2(rejeitarId, motivo.trim());
      toast.success("Solicitação rejeitada");
      setRejeitarId(null);
      setMotivo("");
      void refresh(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao rejeitar");
    } finally {
      setBusy(false);
    }
  }

  async function direcionar(id: string) {
    setBusy(true);
    try {
      await staffGateDirecionarOperacao(id);
      toast.success("Caminhão direcionado");
      void refresh(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao direcionar");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !dash) {
    return <Skeleton className="h-[calc(100vh-140px)] w-full" />;
  }

  if (error && !dash) {
    return (
      <WidgetError
        title="Dados indisponíveis"
        message={error.message}
        onRetry={() => void refresh()}
      />
    );
  }

  if (!dash) return null;

  return (
    <>
      <div className="grid h-[calc(100vh-7.5rem)] grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Q1 — Autorizações */}
        <Quadrant
          title="Autorizações Pendentes"
          count={dash.autorizacoesPendentes.total}
          headerAction={
            <Button variant="outline" size="sm" className="text-sm" asChild>
              <Link href="/operador/gate/autorizacoes">Ver Todas →</Link>
            </Button>
          }
        >
          {dash.autorizacoesPendentes.itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma autorização pendente.</p>
          ) : (
            dash.autorizacoesPendentes.itens.map((item) => (
              <DashboardListItem key={item.id}>
                <ContainerNumber value={item.containersIso[0] ?? "—"} className="mb-1" />
                <TipoTamanhoSituacao tipoTamanho={item.tipoTamanho} situacao={item.situacao} />
                <p className="text-base text-white">{item.empresa}</p>
                {podeAutorizar ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 border-green-500/30 text-xs text-green-400 hover:bg-green-500/10"
                      disabled={busy}
                      onClick={() => void aprovar(item.id)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 border-red-500/30 text-xs text-red-400 hover:bg-red-500/10"
                      disabled={busy}
                      onClick={() => setRejeitarId(item.id)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Rejeitar
                    </Button>
                  </div>
                ) : null}
                <Button type="button" variant="link" className="h-7 p-0 text-xs text-[var(--accent)]" asChild>
                  <Link href={`/operador/gate/autorizacoes/${item.id}`}>Ver detalhes →</Link>
                </Button>
              </DashboardListItem>
            ))
          )}
        </Quadrant>

        {/* Q2 — Chegadas + mini fila */}
        <Quadrant title="Previsão de Chegadas" subtitle="Próximas 24h" count={dash.previsaoChegadas.total}>
          {dash.previsaoChegadas.itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem chegadas previstas.</p>
          ) : (
            dash.previsaoChegadas.itens.map((item) => (
              <DashboardListItem
                key={item.id}
                className={cn(item.atrasado && "rounded-md border border-amber-500/30 bg-amber-500/10 px-2")}
              >
                <ContainerNumber value={item.containersIso[0] ?? "—"} className="mb-1" />
                <TipoTamanhoSituacao tipoTamanho={item.tipoTamanho} situacao={item.situacao} />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-white">
                    {item.horario} · {item.turno}
                  </span>
                  <span className="text-muted-foreground">Placa: {item.placa ?? "—"}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.empresa}</p>
              </DashboardListItem>
            ))
          )}

          <MiniResumoHeader title="Fila no gate" count={dash.resumoFila.total} href="/operador/gate/fila" />
          {dash.resumoFila.itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum caminhão aguardando no gate.</p>
          ) : (
            dash.resumoFila.itens.map((item) => (
              <DashboardListItem key={`fila-${item.id}`}>
                <ContainerNumber value={item.containersIso[0] ?? "—"} className="mb-1" />
                <TipoTamanhoSituacao tipoTamanho={item.tipoTamanho} situacao={item.situacao} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>Placa: {item.placa ?? "—"}</span>
                    <span>· {formatChegada(item.chegadaEm)}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 bg-emerald-700 text-sm hover:bg-emerald-600"
                    disabled={busy}
                    onClick={() => void direcionar(item.id)}
                  >
                    Direcionar
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </DashboardListItem>
            ))
          )}
        </Quadrant>

        {/* Q3 — Saídas + mini operação */}
        <Quadrant title="Previsão de Saídas" subtitle="Próximas 24h" count={dash.previsaoSaidas.total}>
          {dash.previsaoSaidas.itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem saídas previstas.</p>
          ) : (
            dash.previsaoSaidas.itens.map((item) => (
              <DashboardListItem
                key={item.id}
                className={cn(item.pronto && "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2")}
              >
                <ContainerNumber value={item.containersIso[0] ?? "—"} className="mb-1" />
                <TipoTamanhoSituacao tipoTamanho={item.tipoTamanho} situacao={item.situacao} />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-white">{item.horarioPrevisto}</span>
                  <span className="text-muted-foreground">Placa: {item.placa ?? "—"}</span>
                </div>
                <div className="mt-0.5">
                  <Badge
                    variant="neutral"
                    className={cn(
                      "text-sm",
                      item.pronto && "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
                    )}
                  >
                    {item.statusLabel}
                  </Badge>
                </div>
              </DashboardListItem>
            ))
          )}

          <MiniResumoHeader
            title="Operação ativa"
            count={dash.resumoOperacao.total}
            href="/operador/gate/operacao"
          />
          {dash.resumoOperacao.itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma operação em andamento.</p>
          ) : (
            dash.resumoOperacao.itens.map((item) => (
              <DashboardListItem key={`op-${item.id}`}>
                <ContainerNumber
                  value={item.containersIso[0] ?? item.protocolo ?? "—"}
                  className="mb-1"
                />
                <TipoTamanhoSituacao tipoTamanho={item.tipoTamanho} situacao={item.situacao} />
                <p className="text-sm text-muted-foreground">
                  {item.empilhadeira ?? "Sem empilhadeira"} · OS: {item.osStatus.replace("_", " ")}
                </p>
              </DashboardListItem>
            ))
          )}
        </Quadrant>

        {/* Q4 — Agenda */}
        <Quadrant
          title="Agenda de Transportes"
          subtitle={`Hoje · Turno atual ${dash.agendaTurnos.turnoAtual}`}
          count={null}
        >
          <div className="flex h-full flex-col gap-3">
            {dash.agendaTurnos.turnos.map((t) => {
              const ativo = t.turno === dash.agendaTurnos.turnoAtual;
              return (
                <div
                  key={t.turno}
                  className={cn(
                    "flex flex-1 flex-col justify-center rounded-lg border px-4 py-4",
                    ativo ? "border-cyan-500/50 bg-cyan-500/10" : "border-white/10 bg-black/20",
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-white">{t.turno}</p>
                      <p className="text-sm text-muted-foreground">{TURNO_FAIXA[t.turno]}</p>
                    </div>
                    <p className="text-sm text-white">
                      {t.chegadasRealizadas}/{t.chegadasPrevistas} cheg. · {t.saidasRealizadas}/
                      {t.saidasPrevistas} saíd.
                    </p>
                  </div>
                  <Progress value={t.progressoPct} className="h-2" />
                </div>
              );
            })}
          </div>
        </Quadrant>
      </div>

      <Dialog open={!!rejeitarId} onOpenChange={(o) => !o && setRejeitarId(null)}>
        <DialogContent className="border-white/10 bg-[#0c1018] text-white">
          <DialogHeader>
            <DialogTitle>Rejeitar autorização</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-auth" className="text-sm text-muted-foreground">
              Motivo
            </Label>
            <Input
              id="motivo-auth"
              className="border-white/15 bg-black/40 text-base"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejeitarId(null)}>
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
    </>
  );
}
