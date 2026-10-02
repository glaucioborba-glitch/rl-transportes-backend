"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Layers, Loader2, RefreshCw, Save } from "lucide-react";
import { FormField, FormSection, CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
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
import { formatContabil, parseMoeda } from "@/lib/financeiro/format";
import {
  TabelaPrecoMatrixGrid,
  type MatrixItemForm,
} from "./tabela-preco-matrix-grid";
import type { FaixaDiariaForm } from "./faixas-diaria-editor";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

type FormState = {
  nome: string;
  descricao: string;
  moeda: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  padrao: boolean;
};

const EMPTY_FORM: FormState = {
  nome: "",
  descricao: "",
  moeda: "BRL",
  dataInicio: new Date().toISOString().split("T")[0],
  dataFim: "",
  ativo: true,
  padrao: false,
};

type Props = { tabelaId?: string; duplicarId?: string };

function nomeCopia(nome: string): string {
  const trimmed = nome.trim();
  return trimmed.startsWith("Cópia de ") ? `${trimmed} (2)` : `Cópia de ${trimmed}`;
}

function toFaixaForms(
  faixas?: { diaInicio: number; diaFim: number | null; valorDiaria: number }[] | null,
  fallbackValor?: number | null,
): FaixaDiariaForm[] {
  if (faixas?.length) {
    return faixas.map((f) => ({
      diaInicio: String(f.diaInicio),
      diaFim: f.diaFim != null ? String(f.diaFim) : "",
      valorDiaria: formatContabil(f.valorDiaria),
    }));
  }
  if (fallbackValor != null && fallbackValor > 0) {
    return [{ diaInicio: "1", diaFim: "", valorDiaria: formatContabil(fallbackValor) }];
  }
  return [];
}

function toMatrixItem(i: CadastroTabelaPrecoItem): MatrixItemForm {
  return {
    categoriaItem: "ARMAZENAGEM",
    tipoOperacaoCodigo: "ARMAZENAGEM",
    tipoContainerCodigo: i.tipoContainerCodigo ?? "",
    capacidadeCodigo: i.capacidadeCodigo ?? "",
    containerTamanho: i.containerTamanho ?? "20'",
    statusContainer: i.statusContainer ?? "CHEIO",
    valorHandling: i.valorHandling != null ? formatContabil(i.valorHandling) : "150,00",
    freeTimeDias: i.freeTimeDias != null ? String(i.freeTimeDias) : "7",
    faixasDiaria: toFaixaForms(i.faixasDiaria),
    faixasEnergiaReefer: toFaixaForms(i.faixasEnergiaReefer, i.tarifaEnergiaReeferDiaria),
    tarifaEnergiaReeferDiaria:
      i.tarifaEnergiaReeferDiaria != null ? String(i.tarifaEnergiaReeferDiaria) : "",
    valor: 0,
    unidade: "POR_CICLO",
  };
}

export function TabelaPrecoForm({ tabelaId, duplicarId }: Props) {
  const router = useRouter();
  const origemId = tabelaId ?? duplicarId;
  const isCopia = Boolean(duplicarId) && !tabelaId;
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(Boolean(origemId));
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [matriz, setMatriz] = useState<MatrixItemForm[]>([]);

  useEffect(() => {
    if (!origemId) return;
    let on = true;
    void (async () => {
      try {
        const [tab, its] = await Promise.all([
          getCadastroTabelaPreco(origemId),
          listCadastroTabelaPrecoItens(origemId),
        ]);
        if (!on) return;
        setFormData({
          nome: isCopia ? nomeCopia(tab.nome) : tab.nome,
          descricao: tab.descricao ?? "",
          moeda: tab.moeda ?? "BRL",
          dataInicio: tab.dataInicio,
          dataFim: tab.dataFim ?? "",
          ativo: isCopia ? true : tab.ativo,
          padrao: isCopia ? false : (tab.padrao ?? false),
        });
        setSyncedAt(isCopia ? null : (tab.syncedAt ?? null));
        const all = its.items ?? [];
        setMatriz(
          all
            .filter((i) => i.categoriaItem === "ARMAZENAGEM" || i.tipoOperacaoCodigo === "ARMAZENAGEM")
            .map(toMatrixItem),
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
  }, [origemId, isCopia]);

  const totalItens = useMemo(() => matriz.length, [matriz.length]);

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
      valorHandling: m.valorHandling ? parseMoeda(m.valorHandling) : undefined,
      freeTimeDias: m.freeTimeDias ? Number(m.freeTimeDias) : undefined,
      faixasDiaria: m.faixasDiaria
        .filter((f) => f.diaInicio && f.valorDiaria)
        .map((f) => ({
          diaInicio: Number(f.diaInicio),
          diaFim: f.diaFim ? Number(f.diaFim) : null,
          valorDiaria: parseMoeda(f.valorDiaria),
        })),
      faixasEnergiaReefer: m.faixasEnergiaReefer
        .filter((f) => f.diaInicio && f.valorDiaria)
        .map((f) => ({
          diaInicio: Number(f.diaInicio),
          diaFim: f.diaFim ? Number(f.diaFim) : null,
          valorDiaria: parseMoeda(f.valorDiaria),
        })),
      tarifaEnergiaReeferDiaria: m.faixasEnergiaReefer.find((f) => f.valorDiaria)
        ? parseMoeda(m.faixasEnergiaReefer.find((f) => f.valorDiaria)!.valorDiaria)
        : m.tarifaEnergiaReeferDiaria
          ? Number(m.tarifaEnergiaReeferDiaria)
          : undefined,
    }));

    return matrixPayload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) {
      toast.error("Nome é obrigatório.");
      return;
    }
    if (totalItens === 0) {
      toast.error("Adicione a matriz de armazenagem.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        dataFim: formData.dataFim || undefined,
        descricao: formData.descricao.trim() || undefined,
        itens: buildPayloadItens(),
      };
      if (tabelaId) {
        await updateCadastroTabelaPreco(tabelaId, payload);
        toast.success("Tabela atualizada e sincronizada!");
      } else {
        await createCadastroTabelaPreco(payload);
        toast.success(isCopia ? "Cópia da tabela cadastrada!" : "Tabela cadastrada!");
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
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      {isCopia ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Cópia da matriz de armazenagem. Ajuste nome, vigência e os valores diferentes. Nada é gravado até
          Salvar.
        </p>
      ) : null}
      <FormSection title="Dados da Tabela" icon={DollarSign}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Nome" required className="min-w-[16rem] flex-1">
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Tabela Padrão 2026"
            />
          </FormField>
          <FormField label="Descrição" className="min-w-[14rem] flex-1">
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição da tabela"
            />
          </FormField>
          <FormField label="Data de Início (opcional)" size="md">
            <Input
              type="date"
              value={formData.dataInicio}
              onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
            />
          </FormField>
          <FormField label="Data de Fim (opcional)" size="md">
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={gerarMatriz}>
            Gerar combinações MDM
          </Button>
          <span className="text-xs text-muted-foreground">
            Usa tipos ativos e tamanhos do Super Admin → Tipos de contêiner. Serviços adicionais
            (inspeção, reparo, transferência…) ficam em Financeiro → Serviços.
          </span>
        </div>
        <TabelaPrecoMatrixGrid items={matriz} onChange={setMatriz} />
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
