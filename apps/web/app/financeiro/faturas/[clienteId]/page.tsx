"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/staff-client";
import {
  agendarFaturaPacote,
  emitirFaturaPacote,
  obterFilaFaturasCliente,
  type FaturaClienteDetalhe,
} from "@/lib/api/fatura-pacote-client";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatBRL } from "@/lib/financeiro/format";
import {
  formatDataHoraBr,
  labelModoFatura,
  linhaMetaIdFatura,
  linhaTituloIdFatura,
  localDatetimeSp,
  localDatetimeToIsoSp,
} from "@/lib/financeiro/fatura-pacote-display";
import { FaturaIdComposicao } from "@/components/financeiro/fatura-id-composicao";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function FinanceiroFaturaClientePage() {
  const params = useParams<{ clienteId: string }>();
  const router = useRouter();
  const clienteId = params.clienteId;
  const user = useStaffAuthStore((s) => s.user);
  const ok = isIntranetGestorRole(user?.role);
  const [detalhe, setDetalhe] = useState<FaturaClienteDetalhe | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [emitindo, setEmitindo] = useState(false);
  const [agendarAberto, setAgendarAberto] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [agendadoLocal, setAgendadoLocal] = useState(localDatetimeSp);

  const carregar = useCallback(async () => {
    if (!ok || !clienteId) return;
    setLoading(true);
    try {
      const out = await obterFilaFaturasCliente(clienteId);
      setDetalhe(out);
      setMarcados(new Set(out.ids.map((i) => i.faturaId)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível abrir a fila.");
    } finally {
      setLoading(false);
    }
  }, [ok, clienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const selecionados = useMemo(
    () => (detalhe?.ids ?? []).filter((i) => marcados.has(i.faturaId)),
    [detalhe, marcados],
  );
  const totalMarcado = selecionados.reduce((s, i) => s + i.valorTotal, 0);

  function toggle(id: string) {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function marcarTodos(todos: boolean) {
    if (!detalhe) return;
    setMarcados(todos ? new Set(detalhe.ids.map((i) => i.faturaId)) : new Set());
  }

  async function onAgendar() {
    if (!clienteId || selecionados.length === 0 || !agendadoLocal) return;
    setAgendando(true);
    try {
      const out = await agendarFaturaPacote(
        clienteId,
        selecionados.map((i) => i.faturaId),
        localDatetimeToIsoSp(agendadoLocal),
      );
      toast.success(`${out.numero} agendada para ${formatDataHoraBr(out.agendadoPara)}.`);
      setAgendarAberto(false);
      router.push("/financeiro/faturas");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível agendar a Fatura.");
    } finally {
      setAgendando(false);
    }
  }

  async function onEmitir() {
    if (!clienteId || selecionados.length === 0) return;
    setEmitindo(true);
    try {
      const out = await emitirFaturaPacote(
        clienteId,
        selecionados.map((i) => i.faturaId),
      );
      toast.success(`${out.numero} em emissão. NFS-e e cobrança seguem no pacote.`);
      router.push("/financeiro/faturas");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível emitir a Fatura.");
    } finally {
      setEmitindo(false);
    }
  }

  if (!ok) {
    return (
      <div>
        <p className="text-amber-400">Área restrita a gestão (ADMIN / GERENTE).</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!detalhe) return null;

  const { cliente, ids } = detalhe;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{cliente.razaoSocial}</h1>
          {cliente.nomeFantasia ? (
            <p className="mt-0.5 text-sm text-zinc-500">{cliente.nomeFantasia}</p>
          ) : null}
          <p className="mt-1 font-mono text-sm text-zinc-400">{formatCpfCnpjBr(cliente.cpfCnpj)}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {labelModoFatura(cliente.faturamentoModo, cliente.faturamentoHora)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Selecionado</p>
          <p className="text-xl font-semibold text-white">{formatBRL(totalMarcado)}</p>
          <p className="text-xs text-zinc-500">
            {selecionados.length} de {ids.length} ID(s)
          </p>
        </div>
      </div>

      <p className="text-sm text-zinc-400">
        Marque o ID inteiro. A cobrança não parte linha. Abaixo de cada ID estão os valores que
        formaram o total (diárias, handling, serviços, extras).
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={ids.length > 0 && selecionados.length === ids.length}
            onChange={(e) => marcarTodos(e.target.checked)}
          />
          Marcar todos
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={emitindo || agendando || selecionados.length === 0}
            onClick={() => {
              setAgendadoLocal(localDatetimeSp());
              setAgendarAberto(true);
            }}
          >
            Agendar Emissão de Fatura
          </Button>
          <Button
            type="button"
            disabled={emitindo || agendando || selecionados.length === 0}
            onClick={() => void onEmitir()}
          >
            {emitindo ? "Emitindo…" : `Emitir Fatura (${selecionados.length})`}
          </Button>
        </div>
      </div>

      {ids.length === 0 ? (
        <p className="text-sm text-zinc-500">Este cliente não tem ID encerrado na fila.</p>
      ) : (
        ids.map((row) => (
          <Card key={row.faturaId} className="border-zinc-800 bg-zinc-950/80">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <label className="flex min-w-0 items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={marcados.has(row.faturaId)}
                  onChange={() => toggle(row.faturaId)}
                  aria-label={`Incluir ${row.idLabel}`}
                />
                <div>
                  <CardTitle className="text-base text-zinc-100">
                    {linhaTituloIdFatura(row)}
                  </CardTitle>
                  <p className="mt-1 text-xs text-zinc-500">{linhaMetaIdFatura(row)}</p>
                </div>
              </label>
              <p className="text-lg font-semibold text-white">{formatBRL(row.valorTotal)}</p>
            </CardHeader>
            <CardContent>
              <FaturaIdComposicao linhas={row.composicao} />
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={agendarAberto} onOpenChange={setAgendarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar emissão de Fatura</DialogTitle>
            <DialogDescription>
              Os IDs marcados saem da fila e a emissão roda na data e hora (horário de Brasília),
              como no modo automático.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-sm text-zinc-300">
            Data e hora
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              value={agendadoLocal}
              onChange={(e) => setAgendadoLocal(e.target.value)}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAgendarAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={agendando || !agendadoLocal} onClick={() => void onAgendar()}>
              {agendando ? "Agendando…" : "Confirmar agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
