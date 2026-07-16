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
import { useGateCockpitContext } from "./gate-cockpit-context";

type ContainerRow = {
  tipo?: string;
  tamanho?: string;
  status?: string;
  unidade?: string;
};

type AutorizacaoItem = {
  id: string;
  protocolo: string;
  empresa: string;
  container: string;
  tipoTamanho: string | null;
  situacao: GateContainerSituacao | null;
  status: string;
  criadoEm: string;
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

function mapItem(row: Record<string, unknown>): AutorizacaoItem {
  const containers = (row.containersSolicitacao as ContainerRow[] | undefined) ?? [];
  const cs = containers[0];
  const isos = collectSolicitacaoContainerISOs({ containersSolicitacao: containers });
  const cliente = row.cliente as { razaoSocial?: string } | undefined;
  const situacao =
    cs?.status === "CHEIO" ? "CHEIO" : cs?.status === "VAZIO" ? "VAZIO" : null;

  return {
    id: String(row.id),
    protocolo: String(row.protocolo ?? ""),
    empresa: cliente?.razaoSocial ?? "—",
    container: isos[0] ?? "—",
    tipoTamanho: cs?.tipo && cs?.tamanho ? `${cs.tipo} / ${cs.tamanho}` : null,
    situacao,
    status: String(row.status ?? ""),
    criadoEm: String(row.createdAt ?? ""),
  };
}

export function GateAutorizacoesPanel() {
  const { refresh } = useGateCockpitContext();
  const user = useStaffAuthStore((s) => s.user);
  const podeAutorizar = podeAprovarOs(user);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AutorizacaoItem[]>([]);
  const [rejeitarId, setRejeitarId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendente, analise] = await Promise.all([
        staffListarSolicitacoesV2({ status: "PENDENTE", limit: 100, page: 1 }),
        staffListarSolicitacoesV2({ status: "EM_ANALISE", limit: 100, page: 1 }),
      ]);
      const merged = new Map<string, AutorizacaoItem>();
      for (const row of [...pendente.items, ...analise.items]) {
        const mapped = mapItem(row as Record<string, unknown>);
        merged.set(mapped.id, mapped);
      }
      const list = Array.from(merged.values()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
      setItems(list);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar autorizações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function aprovar(id: string) {
    setBusy(true);
    try {
      await staffAprovarSolicitacaoV2(id);
      toast.success("Solicitação aprovada");
      await load();
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
      await load();
      void refresh(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao rejeitar");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length} solicitação{items.length === 1 ? "" : "ões"} aguardando autorização
        </p>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma autorização pendente.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex w-full flex-col rounded-lg border border-white/10 bg-[#0b1018]/90 p-5"
            >
              <ContainerNumber value={item.container} className="mb-1" />

              {item.tipoTamanho ? (
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">{item.tipoTamanho}</span>
                  {item.situacao ? <SituacaoBadge situacao={item.situacao} /> : null}
                </div>
              ) : null}

              <p className="text-base text-white">{item.empresa}</p>
              <p className="text-sm text-muted-foreground">
                {item.protocolo} · {item.status.replace("_", " ")}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-auto lg:pt-3">
                {podeAutorizar ? (
                  <>
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
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="link"
                  className="h-7 p-0 text-xs text-[var(--accent)] lg:ml-auto"
                  asChild
                >
                  <Link href={`/operador/gate/autorizacoes/${item.id}`}>Ver detalhes →</Link>
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
