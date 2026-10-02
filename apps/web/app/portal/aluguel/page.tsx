"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { PortalAgendamentoGuard } from "@/components/portal/portal-agendamento-guard";
import { RawStatusBadge } from "@/components/portal/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  criarSolicitacaoAluguelPortal,
  listarSolicitacoesAluguelPortal,
  type PortalSolicitacaoAluguel,
} from "@/lib/api/portal-client";
import {
  FINALIDADE_ALUGUEL_OPCOES,
  STATUS_SOLICITACAO_ALUGUEL_LABEL,
  formatYmdBr,
  rotuloFinalidadeAluguel,
  todayLocalIso,
  type FinalidadeAluguel,
} from "@/lib/aluguel-solicitacao";
import { formatIsoDisplay } from "@/lib/container-display";
import { solicitacaoStatusVariant } from "@/lib/portal-status";
import {
  SOLICITACAO_CARD_C,
  SOLICITACAO_CARD_H,
  SOLICITACAO_FORM_GRID,
  SOLICITACAO_SELECT_CLS,
} from "@/components/portal/solicitacao-form-layout";
import { toast } from "@/lib/toast";

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function PortalAluguelPage() {
  const hoje = todayLocalIso();
  const [finalidade, setFinalidade] = useState<FinalidadeAluguel | "">("");
  const [dataColeta, setDataColeta] = useState("");
  const [dataDevolucao, setDataDevolucao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<PortalSolicitacaoAluguel[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarSolicitacoesAluguelPortal();
      setItens(res.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar os pedidos de aluguel.");
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!finalidade) {
      toast.error("Selecione a finalidade.");
      return;
    }
    if (dataColeta && dataDevolucao && dataDevolucao <= dataColeta) {
      toast.error("A previsão de devolução deve ser depois da coleta prevista.");
      return;
    }
    setEnviando(true);
    try {
      await criarSolicitacaoAluguelPortal({
        finalidade,
        dataColeta: dataColeta || undefined,
        dataPrevistaDevolucao: dataDevolucao || undefined,
      });
      toast.success("Pedido enviado. Aguarde a autorização da operação.");
      setFinalidade("");
      setDataColeta("");
      setDataDevolucao("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível enviar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PortalAgendamentoGuard>
      <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Aluguel</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cada pedido é de uma unidade da frota. Ele vai para Autorizações na intranet e só segue
            depois da aprovação.
          </p>
        </div>

        <Card className="border-white/10 bg-[#0b1018]/90">
          <CardHeader className={SOLICITACAO_CARD_H}>
            <SectionTitle>Nova solicitação</SectionTitle>
          </CardHeader>
          <CardContent className={SOLICITACAO_CARD_C}>
            <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <div className={SOLICITACAO_FORM_GRID}>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="finalidade-aluguel">Finalidade</Label>
                  <select
                    id="finalidade-aluguel"
                    className={SOLICITACAO_SELECT_CLS}
                    value={finalidade}
                    onChange={(e) => setFinalidade(e.target.value as FinalidadeAluguel | "")}
                    required
                  >
                    <option value="">Selecione</option>
                    {FINALIDADE_ALUGUEL_OPCOES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coleta-aluguel">Previsão de coleta</Label>
                  <Input
                    id="coleta-aluguel"
                    type="date"
                    min={hoje}
                    value={dataColeta}
                    onChange={(e) => setDataColeta(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">Opcional. Ajuda a operação interna; não trava o pedido.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="devolucao-aluguel">Previsão de devolução</Label>
                  <Input
                    id="devolucao-aluguel"
                    type="date"
                    min={addDaysIso(dataColeta || hoje, 1)}
                    value={dataDevolucao}
                    onChange={(e) => setDataDevolucao(e.target.value)}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">Opcional.</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-400"
                      disabled={!dataDevolucao}
                      onClick={() => setDataDevolucao("")}
                    >
                      Deixar em branco
                    </Button>
                  </div>
                </div>
              </div>
              <Button type="submit" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar solicitação"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <SectionTitle>Seus pedidos</SectionTitle>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : itens.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum pedido de aluguel ainda.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {itens.map((item) => (
                <Card key={item.id} className="border-white/10 bg-[#0b1018]/90">
                  <CardContent className="space-y-1 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{item.protocolo}</p>
                      <RawStatusBadge
                        label={STATUS_SOLICITACAO_ALUGUEL_LABEL[item.status] ?? item.status}
                        variant={solicitacaoStatusVariant(item.status)}
                      />
                    </div>
                    <p className="text-sm text-slate-300">{rotuloFinalidadeAluguel(item.finalidade)}</p>
                    {item.contrato ? (
                      <p className="text-sm text-slate-200">
                        {formatIsoDisplay(item.contrato.unidadeIso)} · {item.contrato.idLabel ?? "—"}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-400">
                      Coleta prevista {formatYmdBr(item.dataColeta)} · Previsão de devolução{" "}
                      {formatYmdBr(item.dataPrevistaDevolucao)}
                    </p>
                    {item.motivoRejeicao ? (
                      <p className="text-xs text-rose-400">Motivo: {item.motivoRejeicao}</p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </PortalAgendamentoGuard>
  );
}
