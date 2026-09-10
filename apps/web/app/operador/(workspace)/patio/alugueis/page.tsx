"use client";

import { useMemo, useState } from "react";
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
} from "@/lib/api/alugueis-client";
import { ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export default function PatioAlugueisPage() {
  const frota = useWidgetData(() => listAlugueisFrota(), []);
  const contratos = useWidgetData(() => listAlugueis("ATIVO"), []);
  const clientes = useWidgetData(() => listAlugueisClientes(), []);
  const [unidadeId, setUnidadeId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [devolverId, setDevolverId] = useState<string | null>(null);

  const disponiveis = (frota.data?.items ?? []).filter((u) => u.status === "DISPONIVEL");
  const clientesFiltrados = useMemo(() => {
    const q = clienteBusca.trim().toLowerCase();
    const list = clientes.data?.items ?? [];
    if (!q) return list.slice(0, 80);
    return list
      .filter((c) => c.razaoSocial.toLowerCase().includes(q) || (c.nomeFantasia ?? "").toLowerCase().includes(q))
      .slice(0, 80);
  }, [clienteBusca, clientes.data]);

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
      toast.success(`Aluguel iniciado. ${out.unidadeIso} · ID ${out.numero}.`);
      setUnidadeId("");
      setObs("");
      await Promise.all([frota.refetch(), contratos.refetch()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao iniciar aluguel.");
    } finally {
      setSaving(false);
    }
  }

  async function devolver(id: string) {
    setDevolverId(id);
    try {
      const out = await devolverAluguel(id);
      toast.success(`Devolução registrada. ID ${out.numero} encerrado.`);
      await Promise.all([frota.refetch(), contratos.refetch()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao devolver.");
    } finally {
      setDevolverId(null);
    }
  }

  return (
    <main className="space-y-6 p-6">
      <PageBackButton href="/operador/patio" />
      <div>
        <h1 className="text-2xl font-bold">Aluguéis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O aluguel tem ID próprio. Hospedar a mesma caixa no pátio (handling + estadia) é outro ID, pelo Gate.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Iniciar aluguel</h2>
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
                  {u.unidadeIso} · {u.tipoContainerCodigo} {u.containerTamanho}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[12rem] flex-[2] text-sm">
            <span className="mb-1 block text-muted-foreground">Cliente</span>
            <Input
              className="mb-2"
              placeholder="Buscar cliente"
              value={clienteBusca}
              onChange={(e) => setClienteBusca(e.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Selecione</option>
              {clientesFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razaoSocial}
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
            Nenhuma unidade disponível. Cadastre a frota em Operacional → Unidades de aluguel.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Contratos ativos</h2>
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
                    <td className="py-2 pr-4">{c.unidadeIso}</td>
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

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Frota</h2>
        {frota.loading ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : null}
        {frota.error ? <WidgetError title="Não foi possível carregar a frota" onRetry={frota.refetch} /> : null}
        <div className="flex flex-wrap gap-3">
          {(frota.data?.items ?? []).map((u) => (
            <div key={u.id} className="min-w-[14rem] rounded-md border border-border px-3 py-2">
              <div className="font-medium">{u.unidadeIso}</div>
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
