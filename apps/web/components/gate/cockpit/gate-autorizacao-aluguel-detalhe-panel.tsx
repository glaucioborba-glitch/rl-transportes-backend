"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataField } from "@/components/ui/data-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/staff-client";
import {
  staffAprovarSolicitacaoAluguel,
  staffListarMotivosRejeicaoAluguel,
  staffObterSolicitacaoAluguel,
  staffRejeitarSolicitacaoAluguel,
  type MotivoRejeicaoAluguel,
  type StaffSolicitacaoAluguel,
} from "@/lib/api/alugueis-client";
import { formatYmdBr, rotuloFinalidadeAluguel } from "@/lib/aluguel-solicitacao";
import { podeAprovarOs } from "@/lib/gate/gate-cockpit-permissions";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = { id: string };

export function GateAutorizacaoAluguelDetalhePanel({ id }: Props) {
  const router = useRouter();
  const user = useStaffAuthStore((s) => s.user);
  const podeAutorizar = podeAprovarOs(user);
  const [item, setItem] = useState<StaffSolicitacaoAluguel | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejeitarAberto, setRejeitarAberto] = useState(false);
  const [motivos, setMotivos] = useState<MotivoRejeicaoAluguel[]>([]);
  const [motivoId, setMotivoId] = useState("");
  const [observacao, setObservacao] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItem(await staffObterSolicitacaoAluguel(id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar o pedido de aluguel");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!rejeitarAberto) return;
    let on = true;
    void (async () => {
      try {
        const res = await staffListarMotivosRejeicaoAluguel();
        if (on) setMotivos(res.items);
      } catch {
        if (on) {
          setMotivos([]);
          toast.error("Não foi possível carregar os motivos de rejeição de aluguel.");
        }
      }
    })();
    return () => {
      on = false;
    };
  }, [rejeitarAberto]);

  const motivoSelecionado = motivos.find((m) => m.id === motivoId) ?? null;

  async function aprovar() {
    setBusy(true);
    try {
      await staffAprovarSolicitacaoAluguel(id);
      toast.success("Pedido de aluguel autorizado");
      router.push("/operador/gate/autorizacoes");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao aprovar");
    } finally {
      setBusy(false);
    }
  }

  async function rejeitar() {
    if (!motivoSelecionado) {
      toast.error("Selecione o motivo da rejeição.");
      return;
    }
    if (motivoSelecionado.exigeObservacao && !observacao.trim()) {
      toast.error("Este motivo exige observação.");
      return;
    }
    const texto = observacao.trim()
      ? `${motivoSelecionado.descricao}: ${observacao.trim()}`
      : motivoSelecionado.descricao;
    setBusy(true);
    try {
      await staffRejeitarSolicitacaoAluguel(id, texto);
      toast.success("Pedido de aluguel rejeitado");
      setRejeitarAberto(false);
      setMotivoId("");
      setObservacao("");
      router.push("/operador/gate/autorizacoes");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao rejeitar");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/operador/gate/autorizacoes">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Pedido de aluguel não encontrado.</p>
      </div>
    );
  }

  const pendente = item.status === "PENDENTE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link href="/operador/gate/autorizacoes">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Autorizações
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Pedido de aluguel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.protocolo} · {item.status.replace("_", " ")}
          </p>
        </div>
        {podeAutorizar && pendente ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              disabled={busy}
              onClick={() => void aprovar()}
            >
              <Check className="mr-1 h-4 w-4" />
              Aprovar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              disabled={busy}
              onClick={() => {
                setMotivoId("");
                setObservacao("");
                setRejeitarAberto(true);
              }}
            >
              <X className="mr-1 h-4 w-4" />
              Rejeitar
            </Button>
          </div>
        ) : null}
      </div>

      <Card className="border-white/10 bg-[#0b1018]/90">
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <DataField label="Cliente" value={item.empresa ?? "—"} />
          <DataField
            label="Protocolo"
            value={item.protocolo}
          />
          <div>
            <p className="text-xs text-muted-foreground">Tipo</p>
            <Badge variant="neutral" className="mt-1 text-xs">
              Aluguel
            </Badge>
          </div>
          <DataField label="Finalidade" value={rotuloFinalidadeAluguel(item.finalidade)} />
          <DataField label="Coleta prevista" value={formatYmdBr(item.dataColeta)} />
          <DataField label="Previsão de devolução" value={formatYmdBr(item.dataPrevistaDevolucao)} />
          {item.motivoRejeicao ? <DataField label="Motivo da rejeição" value={item.motivoRejeicao} /> : null}
        </CardContent>
      </Card>

      <Dialog open={rejeitarAberto} onOpenChange={setRejeitarAberto}>
        <DialogContent className="border-white/10 bg-[#0c1018] text-white">
          <DialogHeader>
            <DialogTitle>Rejeitar pedido de aluguel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="motivo-aluguel" className="text-sm text-muted-foreground">
                Motivo
              </Label>
              <select
                id="motivo-aluguel"
                className="h-10 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm"
                value={motivoId}
                onChange={(e) => setMotivoId(e.target.value)}
              >
                <option value="">Selecione</option>
                {motivos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.descricao}
                  </option>
                ))}
              </select>
              {motivos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Cadastre motivos em Operacional → Motivos de Rejeição (tipo Rejeição Aluguel).
                </p>
              ) : null}
            </div>
            {motivoSelecionado?.exigeObservacao ? (
              <div className="space-y-2">
                <Label htmlFor="obs-aluguel" className="text-sm text-muted-foreground">
                  Observação
                </Label>
                <Input
                  id="obs-aluguel"
                  className="border-white/15 bg-black/40 text-base"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejeitarAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-rose-700 hover:bg-rose-600"
              disabled={
                busy ||
                !motivoSelecionado ||
                (motivoSelecionado.exigeObservacao && !observacao.trim())
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
