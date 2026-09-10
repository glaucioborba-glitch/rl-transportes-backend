"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaServicoForm } from "../components/tabela-servico-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/cadastros/form-field";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  createCadastroServicoItem,
  listCadastroServicoItens,
  updateCadastroServicoItem,
  type ServicoEfeito,
} from "@/lib/api/cadastros-tabelas-servicos-client";
import { ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function TabelaServicoPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data, loading, error, refetch } = useWidgetData(() => listCadastroServicoItens(id), [id]);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [unidade, setUnidade] = useState("POR_UNIDADE");
  const [efeito, setEfeito] = useState<ServicoEfeito>("NENHUM");
  const [servicoLacreTerminalCodigo, setServicoLacreTerminalCodigo] = useState("");
  const [saving, setSaving] = useState(false);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(valor.replace(",", "."));
    if (!codigo.trim() || !nome.trim() || !Number.isFinite(v) || v < 0) {
      toast.error("Informe código, nome e valor.");
      return;
    }
    setSaving(true);
    try {
      await createCadastroServicoItem(id, {
        codigo: codigo.trim(),
        nome: nome.trim(),
        valor: v,
        unidade,
        ativo: true,
        efeito,
        servicoLacreTerminalCodigo: servicoLacreTerminalCodigo || undefined,
      });
      setCodigo("");
      setNome("");
      setValor("");
      setEfeito("NENHUM");
      setServicoLacreTerminalCodigo("");
      toast.success("Serviço incluído.");
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao incluir.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(
    itemId: string,
    ativo: boolean,
    current: {
      codigo: string;
      nome: string;
      valor: number;
      unidade: string;
      efeito?: ServicoEfeito;
      servicoLacreTerminalCodigo?: string;
      observacaoRic?: string;
    },
  ) {
    try {
      await updateCadastroServicoItem(id, itemId, {
        ...current,
        ativo,
        efeito: current.efeito ?? "NENHUM",
      });
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar.");
    }
  }

  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Tabela de serviços" />
      <FinanceiroTabs />
      <TabelaServicoForm tabelaId={id} />

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-bold">Serviços desta tabela</h2>
        <form onSubmit={adicionar} className="mb-6 flex flex-wrap items-end gap-4">
          <FormField label="Código" required size="sm">
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="uppercase" />
          </FormField>
          <FormField label="Nome" required className="min-w-[12rem] flex-1">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </FormField>
          <FormField label="Valor (R$)" required size="sm">
            <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
          </FormField>
          <FormField label="Unidade" size="md">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
            >
              <option value="POR_UNIDADE">Por unidade</option>
              <option value="POR_HORA">Por hora</option>
              <option value="POR_DIA">Por dia</option>
              <option value="POR_OPERACAO">Por operação</option>
            </select>
          </FormField>
          <FormField label="Ação no sistema" className="min-w-[16rem] flex-1">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={efeito}
              onChange={(e) => setEfeito(e.target.value as ServicoEfeito)}
            >
              <option value="NENHUM">Só cobrar (sem alterar operação)</option>
              <option value="SUBSTITUIR_LACRE_SAIDA">Trocar lacre na RIC de saída</option>
              <option value="TRANSBORDO_CARGA">Transbordo (A cheio → vazio / B vazio → cheio)</option>
            </select>
          </FormField>
          {efeito === "SUBSTITUIR_LACRE_SAIDA" ? (
            <FormField label="Código do lacre da RL (se cobrado)" size="md">
              <Input
                value={servicoLacreTerminalCodigo}
                onChange={(e) => setServicoLacreTerminalCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: LACRE_RL"
                className="uppercase"
              />
            </FormField>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Incluir
          </Button>
        </form>

        {loading ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : null}
        {!loading && error ? <WidgetError title="Não foi possível carregar itens" onRetry={refetch} /> : null}
        {!loading && !error ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Código</th>
                <th>Nome</th>
                <th>Valor</th>
                <th>Unidade</th>
                <th>Ação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2 font-mono">{item.codigo}</td>
                  <td>{item.nome}</td>
                  <td>{money(item.valor)}</td>
                  <td>{item.unidade}</td>
                  <td>{item.efeito === "SUBSTITUIR_LACRE_SAIDA" ? "Lacre saída" : item.efeito === "TRANSBORDO_CARGA" ? "Transbordo" : "—"}</td>
                  <td className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void toggleAtivo(item.id, !item.ativo, {
                          codigo: item.codigo,
                          nome: item.nome,
                          valor: item.valor,
                          unidade: item.unidade,
                          efeito: item.efeito,
                          servicoLacreTerminalCodigo: item.servicoLacreTerminalCodigo,
                          observacaoRic: item.observacaoRic,
                        })
                      }
                    >
                      {item.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
