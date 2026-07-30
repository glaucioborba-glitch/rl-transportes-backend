"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, FileText, Layers, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import { listCadastrosClientes } from "@/lib/api/cadastros-clientes-client";
import { listCadastrosTiposContainer } from "@/lib/api/cadastros-tipos-container-client";
import { listCadastrosTiposOperacao } from "@/lib/api/cadastros-tipos-operacao-client";
import {
  createCadastroTabelaPreco,
  gerarMatrizCombinacoes,
  getCadastroTabelaPreco,
  listCadastroTabelaPrecoItens,
  syncCadastroTabelaPreco,
  updateCadastroTabelaPreco,
  type CadastroTabelaPrecoItem,
} from "@/lib/api/cadastros-tabelas-precos-client";
import { toast } from "@/lib/toast";
import {
  TabelaPrecoMatrixGrid,
  type MatrixItemForm,
} from "./tabela-preco-matrix-grid";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

type FormState = {
  nome: string;
  descricao: string;
  clienteId: string;
  moeda: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  padrao: boolean;
};

const EMPTY_FORM: FormState = {
  nome: "",
  descricao: "",
  clienteId: "",
  moeda: "BRL",
  dataInicio: new Date().toISOString().split("T")[0],
  dataFim: "",
  ativo: true,
  padrao: false,
};

type OperacaoItemForm = {
  categoriaItem: "OPERACAO";
  tipoOperacaoCodigo: string;
  tipoContainerCodigo: string;
  containerTamanho: string;
  valor: string;
  unidade: string;
  valorMinimo: string;
};

const EMPTY_OPERACAO: OperacaoItemForm = {
  categoriaItem: "OPERACAO",
  tipoOperacaoCodigo: "",
  tipoContainerCodigo: "",
  containerTamanho: "20'",
  valor: "",
  unidade: "POR_OPERACAO",
  valorMinimo: "",
};

type Props = { tabelaId?: string };

function toMatrixItem(i: CadastroTabelaPrecoItem): MatrixItemForm {
  return {
    categoriaItem: "ARMAZENAGEM",
    tipoOperacaoCodigo: "ARMAZENAGEM",
    tipoContainerCodigo: i.tipoContainerCodigo ?? "",
    capacidadeCodigo: i.capacidadeCodigo ?? "",
    containerTamanho: i.containerTamanho ?? "20'",
    statusContainer: i.statusContainer ?? "CHEIO",
    valorHandling: i.valorHandling != null ? String(i.valorHandling) : "150",
    freeTimeDias: i.freeTimeDias != null ? String(i.freeTimeDias) : "7",
    faixasDiaria: (i.faixasDiaria ?? []).map((f) => ({
      diaInicio: String(f.diaInicio),
      diaFim: f.diaFim != null ? String(f.diaFim) : "",
      valorDiaria: String(f.valorDiaria),
    })),
    tarifaEnergiaReeferDiaria:
      i.tarifaEnergiaReeferDiaria != null ? String(i.tarifaEnergiaReeferDiaria) : "",
    valor: 0,
    unidade: "POR_CICLO",
  };
}

export function TabelaPrecoForm({ tabelaId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(Boolean(tabelaId));
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [tiposOperacao, setTiposOperacao] = useState<{ id: string; codigo: string; nome: string }[]>(
    [],
  );
  const [tiposContainer, setTiposContainer] = useState<{ id: string; codigo: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; razaoSocial: string }[]>([]);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [matriz, setMatriz] = useState<MatrixItemForm[]>([]);
  const [operacoes, setOperacoes] = useState<OperacaoItemForm[]>([]);

  useEffect(() => {
    void Promise.all([
      listCadastrosTiposOperacao(),
      listCadastrosTiposContainer(),
      listCadastrosClientes({ page: 1, status: "ativos" }),
    ]).then(([op, tc, cli]) => {
      setTiposOperacao(op.items ?? []);
      setTiposContainer(tc.items ?? []);
      setClientes((cli.items ?? []).map((c) => ({ id: c.id, razaoSocial: c.razaoSocial })));
    });
  }, []);

  useEffect(() => {
    if (!tabelaId) return;
    let on = true;
    void (async () => {
      try {
        const [tab, its] = await Promise.all([
          getCadastroTabelaPreco(tabelaId),
          listCadastroTabelaPrecoItens(tabelaId),
        ]);
        if (!on) return;
        setFormData({
          nome: tab.nome,
          descricao: tab.descricao ?? "",
          clienteId: tab.clienteId ?? "",
          moeda: tab.moeda ?? "BRL",
          dataInicio: tab.dataInicio,
          dataFim: tab.dataFim ?? "",
          ativo: tab.ativo,
          padrao: tab.padrao ?? false,
        });
        setSyncedAt(tab.syncedAt ?? null);
        const all = its.items ?? [];
        setMatriz(
          all
            .filter((i) => i.categoriaItem === "ARMAZENAGEM" || i.tipoOperacaoCodigo === "ARMAZENAGEM")
            .map(toMatrixItem),
        );
        setOperacoes(
          all
            .filter((i) => i.categoriaItem !== "ARMAZENAGEM" && i.tipoOperacaoCodigo !== "ARMAZENAGEM")
            .map((i) => ({
              categoriaItem: "OPERACAO" as const,
              tipoOperacaoCodigo: i.tipoOperacaoCodigo,
              tipoContainerCodigo: i.tipoContainerCodigo ?? "",
              containerTamanho: i.containerTamanho ?? "*",
              valor: String(i.valor),
              unidade: i.unidade,
              valorMinimo: i.valorMinimo != null ? String(i.valorMinimo) : "",
            })),
        );
      } catch {
        toast.error("Erro ao carregar tabela.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [tabelaId]);

  const totalItens = useMemo(() => matriz.length + operacoes.length, [matriz.length, operacoes.length]);

  const gerarMatriz = async () => {
    try {
      const res = await gerarMatrizCombinacoes();
      setMatriz((res.items ?? []).map(toMatrixItem));
      toast.success(`${res.total} combinações geradas.`);
    } catch {
      toast.error("Erro ao gerar matriz.");
    }
  };

  const handleSync = async () => {
    if (!tabelaId) return;
    setSyncing(true);
    try {
      const res = await syncCadastroTabelaPreco(tabelaId);
      setSyncedAt(new Date().toISOString());
      toast.success(`Sync OK — ${res.regrasCount} regras no billing.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro no sync.");
    } finally {
      setSyncing(false);
    }
  };

  const buildPayloadItens = () => {
    const matrixPayload = matriz.map((m) => ({
      categoriaItem: "ARMAZENAGEM" as const,
      tipoOperacaoCodigo: "ARMAZENAGEM",
      tipoContainerCodigo: m.tipoContainerCodigo,
      capacidadeCodigo: m.capacidadeCodigo || undefined,
      containerTamanho: m.containerTamanho,
      statusContainer: m.statusContainer as "CHEIO" | "VAZIO",
      valor: 0,
      unidade: "POR_CICLO",
      valorHandling: m.valorHandling ? Number(m.valorHandling) : undefined,
      freeTimeDias: m.freeTimeDias ? Number(m.freeTimeDias) : undefined,
      faixasDiaria: m.faixasDiaria
        .filter((f) => f.diaInicio && f.valorDiaria)
        .map((f) => ({
          diaInicio: Number(f.diaInicio),
          diaFim: f.diaFim ? Number(f.diaFim) : null,
          valorDiaria: Number(f.valorDiaria),
        })),
      tarifaEnergiaReeferDiaria: m.tarifaEnergiaReeferDiaria
        ? Number(m.tarifaEnergiaReeferDiaria)
        : undefined,
    }));

    const opPayload = operacoes.map((i) => ({
      categoriaItem: "OPERACAO" as const,
      tipoOperacaoCodigo: i.tipoOperacaoCodigo,
      tipoContainerCodigo: i.tipoContainerCodigo || undefined,
      containerTamanho: i.containerTamanho,
      valor: Number(i.valor),
      unidade: i.unidade,
      valorMinimo: i.valorMinimo ? Number(i.valorMinimo) : undefined,
    }));

    return [...matrixPayload, ...opPayload];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) {
      toast.error("Nome é obrigatório.");
      return;
    }
    if (totalItens === 0) {
      toast.error("Adicione itens de armazenagem ou operação.");
      return;
    }
    if (operacoes.some((i) => !i.tipoOperacaoCodigo || !i.valor)) {
      toast.error("Itens de operação precisam de tipo e valor.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        clienteId: formData.clienteId || undefined,
        dataFim: formData.dataFim || undefined,
        descricao: formData.descricao.trim() || undefined,
        itens: buildPayloadItens(),
      };
      if (tabelaId) {
        await updateCadastroTabelaPreco(tabelaId, payload);
        toast.success("Tabela atualizada e sincronizada!");
      } else {
        await createCadastroTabelaPreco(payload);
        toast.success("Tabela cadastrada!");
      }
      router.push("/cadastros/financeiro/tabelas-precos");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-6xl space-y-8">
      <FormSection title="Dados da Tabela" icon={DollarSign}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Nome" required>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Tabela Padrão 2026"
            />
          </FormField>
          <FormField label="Cliente (opcional — tabela comercial)">
            <select
              className={SELECT_CLASS}
              value={formData.clienteId}
              onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
              disabled={formData.padrao}
            >
              <option value="">Tabela geral (sem vínculo)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razaoSocial}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Data de Início (opcional)">
            <Input
              type="date"
              value={formData.dataInicio}
              onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
            />
          </FormField>
          <FormField label="Data de Fim (opcional)">
            <Input
              type="date"
              value={formData.dataFim}
              onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
            />
          </FormField>
          <FormField label="Moeda">
            <select
              className={SELECT_CLASS}
              value={formData.moeda}
              onChange={(e) => setFormData({ ...formData, moeda: e.target.value })}
            >
              <option value="BRL">BRL (Real)</option>
              <option value="USD">USD (Dólar)</option>
              <option value="EUR">EUR (Euro)</option>
            </select>
          </FormField>
          <FormField label="Descrição">
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição da tabela"
            />
          </FormField>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.padrao}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  padrao: e.target.checked,
                  clienteId: e.target.checked ? "" : formData.clienteId,
                })
              }
            />
            Tabela padrão do terminal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
            />
            Ativa
          </label>
          {syncedAt && (
            <span className="text-xs text-muted-foreground">
              Billing sync: {new Date(syncedAt).toLocaleString("pt-BR")}
            </span>
          )}
          {tabelaId && (
            <Button type="button" variant="outline" size="sm" disabled={syncing} onClick={handleSync}>
              {syncing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              Re-sincronizar billing
            </Button>
          )}
        </div>
      </FormSection>

      <FormSection title={`Matriz Armazenagem (${matriz.length})`} icon={Layers}>
        <div className="mb-3 flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={gerarMatriz}>
            Gerar combinações MDM
          </Button>
        </div>
        <TabelaPrecoMatrixGrid items={matriz} onChange={setMatriz} />
      </FormSection>

      <FormSection title={`Operações (${operacoes.length})`} icon={FileText}>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 border-b border-border pb-2 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="col-span-3">Tipo de Operação</div>
            <div className="col-span-2">Tipo Contêiner</div>
            <div className="col-span-2">Tamanho</div>
            <div className="col-span-2">Valor (R$)</div>
            <div className="col-span-2">Unidade</div>
            <div className="col-span-1" />
          </div>

          {operacoes.map((item, index) => (
            <div key={index} className="grid grid-cols-12 items-center gap-2 border-b border-border/30 py-2">
              <div className="col-span-3">
                <select
                  className={SELECT_CLASS}
                  value={item.tipoOperacaoCodigo}
                  onChange={(e) =>
                    setOperacoes((prev) =>
                      prev.map((it, i) =>
                        i === index ? { ...it, tipoOperacaoCodigo: e.target.value } : it,
                      ),
                    )
                  }
                >
                  <option value="">Selecione...</option>
                  {tiposOperacao.map((op) => (
                    <option key={op.id} value={op.codigo}>
                      {op.codigo} — {op.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <select
                  className={SELECT_CLASS}
                  value={item.tipoContainerCodigo}
                  onChange={(e) =>
                    setOperacoes((prev) =>
                      prev.map((it, i) =>
                        i === index ? { ...it, tipoContainerCodigo: e.target.value } : it,
                      ),
                    )
                  }
                >
                  <option value="">Todos</option>
                  {tiposContainer.map((tc) => (
                    <option key={tc.id} value={tc.codigo}>
                      {tc.codigo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <select
                  className={SELECT_CLASS}
                  value={item.containerTamanho}
                  onChange={(e) =>
                    setOperacoes((prev) =>
                      prev.map((it, i) =>
                        i === index ? { ...it, containerTamanho: e.target.value } : it,
                      ),
                    )
                  }
                >
                  <option value="*">Todos</option>
                  <option value="20'">20&apos;</option>
                  <option value="40'">40&apos;</option>
                  <option value="45'">45&apos;</option>
                </select>
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  step="0.01"
                  value={item.valor}
                  onChange={(e) =>
                    setOperacoes((prev) =>
                      prev.map((it, i) => (i === index ? { ...it, valor: e.target.value } : it)),
                    )
                  }
                  className="tabular-nums"
                />
              </div>
              <div className="col-span-2">
                <select
                  className={SELECT_CLASS}
                  value={item.unidade}
                  onChange={(e) =>
                    setOperacoes((prev) =>
                      prev.map((it, i) => (i === index ? { ...it, unidade: e.target.value } : it)),
                    )
                  }
                >
                  <option value="POR_OPERACAO">Por operação</option>
                  <option value="POR_HORA">Por hora</option>
                </select>
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOperacoes((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOperacoes((prev) => [...prev, { ...EMPTY_OPERACAO }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Adicionar operação
          </Button>
        </div>
      </FormSection>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar ({totalItens} itens)
        </Button>
      </div>
    </form>
  );
}
