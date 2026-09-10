"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaAluguelForm } from "../components/tabela-aluguel-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/cadastros/form-field";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  createCadastroTabelaAluguelItem,
  listCadastroTabelaAluguelItens,
  updateCadastroTabelaAluguelItem,
} from "@/lib/api/cadastros-tabelas-aluguel-client";
import { listCadastrosTiposContainer } from "@/lib/api/cadastros-tipos-container-client";
import { ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function TabelaAluguelPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data, loading, error, refetch } = useWidgetData(() => listCadastroTabelaAluguelItens(id), [id]);
  const { data: tipos } = useWidgetData(() => listCadastrosTiposContainer(), []);
  const [tipo, setTipo] = useState("");
  const [tamanho, setTamanho] = useState("40'");
  const [diaria, setDiaria] = useState("");
  const [freeTime, setFreeTime] = useState("0");
  const [entrega, setEntrega] = useState("0");
  const [coleta, setColeta] = useState("0");
  const [saving, setSaving] = useState(false);

  const tipoSel = tipos?.items.find((t) => t.codigo === tipo);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(diaria.replace(",", "."));
    if (!tipo.trim() || !tamanho.trim() || !Number.isFinite(v) || v <= 0) {
      toast.error("Informe tipo, tamanho e diária.");
      return;
    }
    setSaving(true);
    try {
      await createCadastroTabelaAluguelItem(id, {
        tipoContainerCodigo: tipo.trim(),
        containerTamanho: tamanho.trim(),
        valorDiaria: v,
        diasFreeTime: Number(freeTime) || 0,
        valorEntrega: Number(entrega.replace(",", ".")) || 0,
        valorColeta: Number(coleta.replace(",", ".")) || 0,
        ativo: true,
      });
      setDiaria("");
      setEntrega("0");
      setColeta("0");
      toast.success("Item incluído.");
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
      tipoContainerCodigo: string;
      containerTamanho: string;
      valorDiaria: number;
      diasFreeTime: number;
      valorEntrega: number;
      valorColeta: number;
    },
  ) {
    try {
      await updateCadastroTabelaAluguelItem(id, itemId, { ...current, ativo });
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar.");
    }
  }

  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Tabela de aluguel" />
      <FinanceiroTabs />
      <TabelaAluguelForm tabelaId={id} />

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-bold">Itens desta tabela</h2>
        <form onSubmit={adicionar} className="mb-6 flex flex-wrap items-end gap-4">
          <FormField label="Tipo" required className="min-w-[12rem] flex-1">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                const t = tipos?.items.find((x) => x.codigo === e.target.value);
                if (t?.tamanhos[0]) setTamanho(t.tamanhos[0]);
              }}
            >
              <option value="">Selecione</option>
              {(tipos?.items ?? []).map((t) => (
                <option key={t.id} value={t.codigo}>
                  {t.codigo} — {t.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Tamanho" required size="sm">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={tamanho}
              onChange={(e) => setTamanho(e.target.value)}
            >
              {(tipoSel?.tamanhos.length ? tipoSel.tamanhos : ["20'", "40'"]).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Diária (R$)" required size="sm">
            <Input value={diaria} onChange={(e) => setDiaria(e.target.value)} inputMode="decimal" />
          </FormField>
          <FormField label="Free time (dias)" size="xs">
            <Input value={freeTime} onChange={(e) => setFreeTime(e.target.value)} inputMode="numeric" />
          </FormField>
          <FormField label="Entrega (R$)" size="sm">
            <Input value={entrega} onChange={(e) => setEntrega(e.target.value)} inputMode="decimal" />
          </FormField>
          <FormField label="Coleta (R$)" size="sm">
            <Input value={coleta} onChange={(e) => setColeta(e.target.value)} inputMode="decimal" />
          </FormField>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Incluir
          </Button>
        </form>

        {loading ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : null}
        {!loading && error ? <WidgetError title="Não foi possível carregar itens" onRetry={refetch} /> : null}

        {!loading && !error ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Tam.</th>
                  <th className="py-2 pr-4">Diária</th>
                  <th className="py-2 pr-4">Free time</th>
                  <th className="py-2 pr-4">Entrega</th>
                  <th className="py-2 pr-4">Coleta</th>
                  <th className="py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">{item.tipoContainerCodigo}</td>
                    <td className="py-2 pr-4">{item.containerTamanho}</td>
                    <td className="py-2 pr-4">{money(item.valorDiaria)}</td>
                    <td className="py-2 pr-4">{item.diasFreeTime}</td>
                    <td className="py-2 pr-4">{money(item.valorEntrega)}</td>
                    <td className="py-2 pr-4">{money(item.valorColeta)}</td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleAtivo(item.id, !item.ativo, item)}
                      >
                        {item.ativo ? "Desativar" : "Reativar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
