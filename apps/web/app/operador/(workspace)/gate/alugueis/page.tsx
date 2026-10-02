"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PageBackButton } from "@/components/ui/page-back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  devolverAluguel,
  iniciarAluguel,
  listAlugueis,
  listAlugueisClientes,
  listAlugueisFrota,
  staffListarReservasAluguel,
} from "@/lib/api/alugueis-client";
import { ApiError } from "@/lib/api/staff-client";
import { formatYmdBr, rotuloFinalidadeAluguel } from "@/lib/aluguel-solicitacao";
import { formatIsoDisplay } from "@/lib/container-display";
import { toast } from "@/lib/toast";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export default function GateAlugueisPage() {
  const frota = useWidgetData(() => listAlugueisFrota(), []);
  const contratos = useWidgetData(() => listAlugueis("ATIVO"), []);
  const reservas = useWidgetData(() => staffListarReservasAluguel(), []);
  const clientes = useWidgetData(() => listAlugueisClientes(), []);
  const [unidadeId, setUnidadeId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [devolverId, setDevolverId] = useState<string | null>(null);
  const [reservaUnidade, setReservaUnidade] = useState<Record<string, string>>({});
  const [iniciandoReserva, setIniciandoReserva] = useState<string | null>(null);
  const [avulsoAberto, setAvulsoAberto] = useState(false);

  const disponiveis = (frota.data?.items ?? []).filter((u) => u.status === "DISPONIVEL");
  const clientesLista = clientes.data?.items ?? [];

  async function iniciar(e: React.FormEvent) {
    e.preventDefault();
    if (!unidadeId || !clienteId) {
      toast.error("Escolha a unidade e o cliente.");
      return;
    }
    setSaving(true);
    try {
      const out = await iniciarAluguel({
        unidadeAluguelId: unidadeId,
        clienteId,
        observacao: obs || undefined,
      });
      toast.success(`Aluguel iniciado. ${formatIsoDisplay(out.unidadeIso)} · ID ${out.numero}.`);
      setUnidadeId("");
      setClienteId("");
      setObs("");
      await Promise.all([frota.refetch(), contratos.refetch(), reservas.refetch()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao iniciar aluguel.");
    } finally {
      setSaving(false);
    }
  }

  async function iniciarReserva(reservaId: string, clienteDaReserva: string) {
    const unidade = reservaUnidade[reservaId];
    if (!unidade) {
      toast.error("Escolha a unidade para esta reserva.");
      return;
    }
    setIniciandoReserva(reservaId);
    try {
      const out = await iniciarAluguel({
        unidadeAluguelId: unidade,
        clienteId: clienteDaReserva,
        solicitacaoAluguelId: reservaId,
      });
      toast.success(`Aluguel iniciado. ${formatIsoDisplay(out.unidadeIso)} · ID ${out.numero}.`);
      setReservaUnidade((prev) => ({ ...prev, [reservaId]: "" }));
      await Promise.all([frota.refetch(), contratos.refetch(), reservas.refetch()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao iniciar aluguel.");
    } finally {
      setIniciandoReserva(null);
    }
  }

  async function devolver(id: string) {
    setDevolverId(id);
    try {
      const out = await devolverAluguel(id);
      toast.success(`Devolução registrada. ID ${out.numero} encerrado.`);
      await Promise.all([frota.refetch(), contratos.refetch(), reservas.refetch()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao devolver.");
    } finally {
      setDevolverId(null);
    }
  }

  return (
    <main className="space-y-6 p-2">
      <PageBackButton href="/operador/gate/controle-entrada-saida" />
      <div>
        <h1 className="text-2xl font-bold">Aluguéis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O caminho normal é o pedido do portal: autorizar, escolher a unidade e iniciar. O aluguel
          tem ID próprio. Hospedar a mesma caixa no pátio é outro ID.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Reservas</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Pedidos autorizados (retirada externa ou uso no pátio), aguardando a operação escolher a
          unidade e iniciar o contrato ligado ao ALU-n.
        </p>
        {reservas.loading ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : null}
        {reservas.error ? (
          <WidgetError title="Não foi possível carregar as reservas" onRetry={reservas.refetch} />
        ) : null}
        {!reservas.loading && !reservas.error && (reservas.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma reserva aguardando início.</p>
        ) : null}
        {!reservas.loading && !reservas.error && (reservas.data?.items.length ?? 0) > 0 && disponiveis.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Nenhuma unidade disponível. Cadastre em Operacional → Unidades de aluguel.
          </p>
        ) : null}
        {!reservas.loading && !reservas.error && (reservas.data?.items.length ?? 0) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="whitespace-nowrap py-2 pr-4">Protocolo</th>
                  <th className="whitespace-nowrap py-2 pr-4">Cliente</th>
                  <th className="whitespace-nowrap py-2 pr-4">Finalidade</th>
                  <th className="whitespace-nowrap py-2 pr-4">Coleta prevista</th>
                  <th className="whitespace-nowrap py-2 pr-4">Previsão de devolução</th>
                  <th className="whitespace-nowrap py-2 pr-4">Unidade</th>
                  <th className="whitespace-nowrap py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(reservas.data?.items ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">{r.protocolo}</td>
                    <td className="py-2 pr-4">{r.empresa ?? "—"}</td>
                    <td className="py-2 pr-4">{rotuloFinalidadeAluguel(r.finalidade)}</td>
                    <td className="py-2 pr-4">{formatYmdBr(r.dataColeta)}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">
                      {formatYmdBr(r.dataPrevistaDevolucao)}
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
                        value={reservaUnidade[r.id] ?? ""}
                        onChange={(e) =>
                          setReservaUnidade((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                      >
                        <option value="">Selecione</option>
                        {disponiveis.map((u) => (
                          <option key={u.id} value={u.id}>
                            {formatIsoDisplay(u.unidadeIso)} · {u.tipoContainerCodigo} {u.containerTamanho}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        disabled={iniciandoReserva === r.id}
                        onClick={() => void iniciarReserva(r.id, r.clienteId)}
                      >
                        {iniciandoReserva === r.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Iniciar aluguel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Contratos ativos</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          A devolução do aluguel é aqui: encerra o ID e libera a unidade da frota. Se a caixa for
          ficar no terminal, isso é outro ID (pátio). Se ela já estiver no estoque, faça a saída do
          pátio antes de encerrar o aluguel.
        </p>
        {contratos.loading ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : null}
        {contratos.error ? <WidgetError title="Não foi possível carregar aluguéis" onRetry={contratos.refetch} /> : null}
        {!contratos.loading && !contratos.error && (contratos.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum aluguel em andamento.</p>
        ) : null}
        {!contratos.loading && !contratos.error ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">ISO</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Saída</th>
                  <th className="py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(contratos.data?.items ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">{c.idLabel}</td>
                    <td className="py-2 pr-4">{formatIsoDisplay(c.unidadeIso)}</td>
                    <td className="py-2 pr-4">{c.clienteNome}</td>
                    <td className="py-2 pr-4">{formatWhen(c.iniciadoEm)}</td>
                    <td className="py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={devolverId === c.id}
                        onClick={() => void devolver(c.id)}
                      >
                        {devolverId === c.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Registrar devolução
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-dashed border-border bg-card/60 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Início avulso</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Exceção: walk-in ou emergência, sem pedido ALU-n. O caminho do dia é Reserva.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setAvulsoAberto((v) => !v)}>
            {avulsoAberto ? "Fechar" : "Abrir início avulso"}
          </Button>
        </div>
        {avulsoAberto ? (
          <>
            <form onSubmit={iniciar} className="flex flex-wrap items-end gap-4">
              <label className="min-w-[14rem] flex-1 text-sm">
                <span className="mb-1 block text-muted-foreground">Unidade disponível</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={unidadeId}
                  onChange={(e) => setUnidadeId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {disponiveis.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatIsoDisplay(u.unidadeIso)} · {u.tipoContainerCodigo} {u.containerTamanho}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[14rem] flex-1 text-sm">
                <span className="mb-1 block text-muted-foreground">Cliente</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {clientesLista.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nomeFantasia || c.razaoSocial}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[12rem] flex-1 text-sm">
                <span className="mb-1 block text-muted-foreground">Observação</span>
                <Input value={obs} onChange={(e) => setObs(e.target.value)} />
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Iniciar aluguel
              </Button>
            </form>
            {!frota.loading && disponiveis.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhuma unidade disponível. Cadastre em Operacional → Unidades de aluguel.
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Unidades próprias</h2>
        {frota.loading ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : null}
        {frota.error ? (
          <WidgetError title="Não foi possível carregar as unidades próprias" onRetry={frota.refetch} />
        ) : null}
        <div className="flex flex-wrap gap-3">
          {(frota.data?.items ?? []).map((u) => (
            <div key={u.id} className="min-w-[14rem] rounded-md border border-border px-3 py-2">
              <div className="font-medium">{formatIsoDisplay(u.unidadeIso)}</div>
              <div className="text-xs text-muted-foreground">
                {u.tipoContainerCodigo} {u.containerTamanho}
              </div>
              <Badge className="mt-2" variant={u.status === "DISPONIVEL" ? "default" : "secondary"}>
                {u.status === "ALUGADA" && u.aluguelAtivo
                  ? `Alugada · ID ${u.aluguelAtivo.numero}`
                  : u.status}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
