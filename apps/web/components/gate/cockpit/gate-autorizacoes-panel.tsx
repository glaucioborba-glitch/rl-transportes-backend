"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  staffAprovarSolicitacaoV2,
  staffListarSolicitacoesV2,
  staffRejeitarSolicitacaoV2,
} from "@/lib/api/staff-client";
import {
  staffAprovarSolicitacaoAluguel,
  staffListarMotivosRejeicaoAluguel,
  staffListarSolicitacoesAluguel,
  staffRejeitarSolicitacaoAluguel,
  type MotivoRejeicaoAluguel,
} from "@/lib/api/alugueis-client";
import { formatYmdBr, rotuloFinalidadeAluguel } from "@/lib/aluguel-solicitacao";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { podeAprovarOs } from "@/lib/gate/gate-cockpit-permissions";
import type { GateContainerSituacao } from "@/lib/gate/gate-cockpit-types";
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
import { ContainerNumber } from "@/components/ui/container-number";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
import { rotuloTomadaPedido } from "@/lib/cadastros/tomada-display";
import { TomadaPedidoBadge } from "@/components/gate/tomada-pedido-badge";
import { SolicitacaoDirecaoBadge } from "@/components/solicitacao/solicitacao-direcao-badge";
import { listCadastrosTiposContainer } from "@/lib/api/cadastros-tipos-container-client";

type ContainerRow = {
  tipo?: string;
  tamanho?: string;
  status?: string;
  unidade?: string;
  refrigerado?: boolean;
  setPoint?: number | null;
};

type AutorizacaoItem = {
  kind: "gate" | "aluguel";
  id: string;
  protocolo: string;
  empresa: string;
  containers: string[];
  tipoTamanho: string | null;
  situacao: GateContainerSituacao | null;
  tomadaLabel: string | null;
  status: string;
  tipoOperacao: string | null;
  criadoEm: string;
  quantidade?: number;
  finalidade?: string | null;
  dataColeta?: string | null;
  dataPrevistaDevolucao?: string | null;
};

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

function mapItem(
  row: Record<string, unknown>,
  tipos: Array<{ codigo: string; tomadaReefer: boolean }>,
): AutorizacaoItem {
  const containers = (row.containersSolicitacao as ContainerRow[] | undefined) ?? [];
  const cs = containers[0];
  const isos = collectSolicitacaoContainerISOs({ containersSolicitacao: containers });
  const cliente = row.cliente as { razaoSocial?: string } | undefined;
  const situacao =
    cs?.status === "CHEIO" ? "CHEIO" : cs?.status === "VAZIO" ? "VAZIO" : null;
  const comTomada = containers.find((c) => rotuloTomadaPedido({ tipo: c.tipo, tipos }));

  return {
    kind: "gate",
    id: String(row.id),
    protocolo: String(row.protocolo ?? ""),
    empresa: cliente?.razaoSocial ?? "—",
    containers: isos.length ? isos : ["—"],
    tipoTamanho: formatTipoTamanhoContainerLabel(cs?.tipo, cs?.tamanho),
    situacao,
    tomadaLabel: rotuloTomadaPedido({
      tipo: (comTomada ?? cs)?.tipo,
      refrigerado: (comTomada ?? cs)?.refrigerado,
      setPoint: (comTomada ?? cs)?.setPoint,
      tipos,
    }),
    status: String(row.status ?? ""),
    tipoOperacao: typeof row.tipoOperacao === "string" ? row.tipoOperacao : null,
    criadoEm: String(row.createdAt ?? ""),
  };
}

export function GateAutorizacoesPanel() {
  const user = useStaffAuthStore((s) => s.user);
  const podeAutorizar = podeAprovarOs(user);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AutorizacaoItem[]>([]);
  const [rejeitarId, setRejeitarId] = useState<string | null>(null);
  const [rejeitarKind, setRejeitarKind] = useState<"gate" | "aluguel">("gate");
  const [motivo, setMotivo] = useState("");
  const [motivosAluguel, setMotivosAluguel] = useState<MotivoRejeicaoAluguel[]>([]);
  const [motivoAluguelId, setMotivoAluguelId] = useState("");
  const [observacaoAluguel, setObservacaoAluguel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [pendente, analise, aluguel, catalogo] = await Promise.all([
        staffListarSolicitacoesV2({ status: "PENDENTE", limit: 100, page: 1 }),
        staffListarSolicitacoesV2({ status: "EM_ANALISE", limit: 100, page: 1 }),
        staffListarSolicitacoesAluguel("PENDENTE").catch(() => ({ items: [] })),
        listCadastrosTiposContainer().catch(() => ({ items: [] as Array<{ codigo: string; tomadaReefer: boolean }> })),
      ]);
      const tiposNext = catalogo.items ?? [];
      const merged = new Map<string, AutorizacaoItem>();
      for (const row of [...pendente.items, ...analise.items]) {
        const mapped = mapItem(row as Record<string, unknown>, tiposNext);
        merged.set(`gate:${mapped.id}`, mapped);
      }
      for (const row of aluguel.items) {
        merged.set(`aluguel:${row.id}`, {
          kind: "aluguel",
          id: row.id,
          protocolo: row.protocolo,
          empresa: row.empresa ?? "—",
          containers: [],
          tipoTamanho: null,
          situacao: null,
          tomadaLabel: null,
          status: row.status,
          tipoOperacao: null,
          criadoEm: row.createdAt,
          quantidade: row.quantidade,
          finalidade: row.finalidade,
          dataColeta: row.dataColeta,
          dataPrevistaDevolucao: row.dataPrevistaDevolucao,
        });
      }
      const list = Array.from(merged.values()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
      setItems(list);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar autorizações");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load({ silent: true }), 15000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!rejeitarId || rejeitarKind !== "aluguel") return;
    let on = true;
    void (async () => {
      try {
        const res = await staffListarMotivosRejeicaoAluguel();
        if (on) setMotivosAluguel(res.items);
      } catch {
        if (on) {
          setMotivosAluguel([]);
          toast.error("Não foi possível carregar os motivos de rejeição de aluguel.");
        }
      }
    })();
    return () => {
      on = false;
    };
  }, [rejeitarId, rejeitarKind]);

  const motivoAluguelSelecionado = motivosAluguel.find((m) => m.id === motivoAluguelId) ?? null;

  async function aprovar(item: AutorizacaoItem) {
    setBusy(true);
    try {
      if (item.kind === "aluguel") {
        await staffAprovarSolicitacaoAluguel(item.id);
        toast.success("Pedido de aluguel autorizado");
      } else {
        await staffAprovarSolicitacaoV2(item.id);
        toast.success("Solicitação aprovada");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao aprovar");
    } finally {
      setBusy(false);
    }
  }

  async function rejeitar() {
    if (!rejeitarId) return;
    let texto = motivo.trim();
    if (rejeitarKind === "aluguel") {
      if (!motivoAluguelSelecionado) {
        toast.error("Selecione o motivo da rejeição.");
        return;
      }
      if (motivoAluguelSelecionado.exigeObservacao && !observacaoAluguel.trim()) {
        toast.error("Este motivo exige observação.");
        return;
      }
      texto = observacaoAluguel.trim()
        ? `${motivoAluguelSelecionado.descricao}: ${observacaoAluguel.trim()}`
        : motivoAluguelSelecionado.descricao;
    } else if (!texto) {
      return;
    }
    setBusy(true);
    try {
      if (rejeitarKind === "aluguel") {
        await staffRejeitarSolicitacaoAluguel(rejeitarId, texto);
      } else {
        await staffRejeitarSolicitacaoV2(rejeitarId, texto);
      }
      toast.success("Solicitação rejeitada");
      setRejeitarId(null);
      setMotivo("");
      setMotivoAluguelId("");
      setObservacaoAluguel("");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao rejeitar");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Autorizações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprovar solicitações de gate e pedidos de aluguel.
          </p>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Autorizações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprovar solicitações de gate e pedidos de aluguel.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {items.length} solicitação{items.length === 1 ? "" : "ões"} aguardando autorização
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma autorização pendente.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <div
              key={`${item.kind}:${item.id}`}
              className="flex w-full flex-col rounded-lg border border-white/10 bg-[#0b1018]/90 p-5"
            >
              {item.kind === "aluguel" ? (
                <div className="mb-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral" className="text-xs">
                      Aluguel
                    </Badge>
                    <span className="text-sm text-white">1 unidade</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{rotuloFinalidadeAluguel(item.finalidade)}</p>
                  <p className="text-xs text-muted-foreground">
                    Coleta prevista {formatYmdBr(item.dataColeta)} · Previsão de devolução{" "}
                    {formatYmdBr(item.dataPrevistaDevolucao)}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-1 space-y-1">
                    {item.containers.map((iso, idx) => (
                      <div key={`${item.id}-${iso}-${idx}`} className="flex flex-wrap items-center gap-2">
                        <ContainerNumber value={iso} />
                        {item.containers.length > 1 ? (
                          <span className="text-xs text-muted-foreground">Unidade #{idx + 1}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {item.tipoTamanho || item.situacao || item.tomadaLabel ? (
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {item.tipoTamanho ? (
                        <span className="text-sm text-muted-foreground">{item.tipoTamanho}</span>
                      ) : null}
                      {item.situacao ? <SituacaoBadge situacao={item.situacao} /> : null}
                      <TomadaPedidoBadge label={item.tomadaLabel} />
                    </div>
                  ) : null}
                </>
              )}

              <p className="text-base text-white">{item.empresa}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {item.kind === "gate" ? <SolicitacaoDirecaoBadge intent={item.tipoOperacao} /> : null}
                <p className="text-sm text-muted-foreground">
                  {item.protocolo} · {item.status.replace("_", " ")}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-auto lg:pt-3">
                {podeAutorizar ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 border-green-500/30 text-xs text-green-400 hover:bg-green-500/10"
                      disabled={busy}
                      onClick={() => void aprovar(item)}
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
                      onClick={() => {
                        setRejeitarKind(item.kind);
                        setMotivo("");
                        setMotivoAluguelId("");
                        setObservacaoAluguel("");
                        setRejeitarId(item.id);
                      }}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Rejeitar
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="link"
                  className="h-7 p-0 text-xs text-[var(--accent)] lg:ml-auto"
                  asChild
                >
                  <Link
                    href={
                      item.kind === "aluguel"
                        ? `/operador/gate/autorizacoes/aluguel/${item.id}`
                        : `/operador/gate/autorizacoes/${item.id}`
                    }
                  >
                    Ver detalhes →
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!rejeitarId} onOpenChange={(o) => !o && setRejeitarId(null)}>
        <DialogContent className="border-white/10 bg-[#0c1018] text-white">
          <DialogHeader>
            <DialogTitle>Rejeitar autorização</DialogTitle>
          </DialogHeader>
          {rejeitarKind === "aluguel" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="motivo-auth-aluguel" className="text-sm text-muted-foreground">
                  Motivo
                </Label>
                <select
                  id="motivo-auth-aluguel"
                  className="h-10 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm"
                  value={motivoAluguelId}
                  onChange={(e) => setMotivoAluguelId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {motivosAluguel.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.descricao}
                    </option>
                  ))}
                </select>
                {motivosAluguel.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Cadastre motivos em Operacional → Motivos de Rejeição (tipo Rejeição Aluguel).
                  </p>
                ) : null}
              </div>
              {motivoAluguelSelecionado?.exigeObservacao ? (
                <div className="space-y-2">
                  <Label htmlFor="obs-auth-aluguel" className="text-sm text-muted-foreground">
                    Observação
                  </Label>
                  <Input
                    id="obs-auth-aluguel"
                    className="border-white/15 bg-black/40 text-base"
                    value={observacaoAluguel}
                    onChange={(e) => setObservacaoAluguel(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="motivo-auth-full" className="text-sm text-muted-foreground">
                Motivo
              </Label>
              <Input
                id="motivo-auth-full"
                className="border-white/15 bg-black/40 text-base"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejeitarId(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-rose-700 hover:bg-rose-600"
              disabled={
                busy ||
                (rejeitarKind === "aluguel"
                  ? !motivoAluguelSelecionado ||
                    (motivoAluguelSelecionado.exigeObservacao && !observacaoAluguel.trim())
                  : !motivo.trim())
              }
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
