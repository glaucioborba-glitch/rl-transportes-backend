"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container, Layers, Loader2, Plus, Save, X } from "lucide-react";
import { CADASTRO_FORM_CLASS, FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroTabelaAluguel,
  getCadastroTabelaAluguel,
  listCadastroTabelaAluguelItens,
  updateCadastroTabelaAluguel,
  type CadastroTabelaAluguelItem,
} from "@/lib/api/cadastros-tabelas-aluguel-client";
import { listCadastrosTiposContainer } from "@/lib/api/cadastros-tipos-container-client";
import { toast } from "@/lib/toast";
import { formatContabil, parseMoeda } from "@/lib/financeiro/format";
import type { FaixaDiariaForm } from "../../tabelas-precos/components/faixas-diaria-editor";
import {
  TabelaAluguelMatrixGrid,
  formatTamanhoOpcao,
  type AluguelMatrixItemForm,
} from "./tabela-aluguel-matrix-grid";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type FormState = {
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  padrao: boolean;
};

const EMPTY: FormState = {
  nome: "",
  descricao: "",
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

function toMatrixItem(item: CadastroTabelaAluguelItem): AluguelMatrixItemForm {
  return {
    tipoContainerCodigo: item.tipoContainerCodigo,
    containerTamanho: formatTamanhoOpcao(item.containerTamanho),
    valorHandling: formatContabil(item.valorHandling ?? 0),
    diasFreeTime: String(item.diasFreeTime ?? 0),
    faixasDiaria: toFaixaForms(item.faixasDiaria, item.valorDiaria),
  };
}

export function TabelaAluguelForm({ tabelaId, duplicarId }: Props) {
  const router = useRouter();
  const origemId = tabelaId ?? duplicarId;
  const isCopia = Boolean(duplicarId) && !tabelaId;
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(origemId));
  const [form, setForm] = useState<FormState>(EMPTY);
  const [matriz, setMatriz] = useState<AluguelMatrixItemForm[]>([]);
  const [tipos, setTipos] = useState<Array<{ codigo: string; nome: string; tamanhos: string[] }>>([]);
  const [novoTipo, setNovoTipo] = useState("");
  const [novoTam, setNovoTam] = useState("");

  useEffect(() => {
    void listCadastrosTiposContainer().then((r) => {
      const ativos = (r.items ?? []).filter((t) => t.ativo);
      setTipos(ativos.map((t) => ({ codigo: t.codigo, nome: t.nome, tamanhos: t.tamanhos })));
      if (ativos[0]) {
        setNovoTipo(ativos[0].codigo);
        const tam = ativos[0].tamanhos[0];
        setNovoTam(tam ? formatTamanhoOpcao(tam) : "20'");
      }
    });
  }, []);

  useEffect(() => {
    if (!origemId) return;
    let on = true;
    void (async () => {
      try {
        const [tab, its] = await Promise.all([
          getCadastroTabelaAluguel(origemId),
          listCadastroTabelaAluguelItens(origemId),
        ]);
        if (!on) return;
        setForm({
          nome: isCopia ? nomeCopia(tab.nome) : tab.nome,
          descricao: tab.descricao ?? "",
          dataInicio: tab.dataInicio,
          dataFim: tab.dataFim ?? "",
          ativo: isCopia ? true : tab.ativo,
          padrao: isCopia ? false : tab.padrao,
        });
        setMatriz((its.items ?? []).map(toMatrixItem));
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

  const tipoSel = useMemo(() => tipos.find((t) => t.codigo === novoTipo), [tipos, novoTipo]);
  const tamanhosNovo = (tipoSel?.tamanhos.length ? tipoSel.tamanhos : ["20", "40"]).map(formatTamanhoOpcao);

  function adicionarLinha() {
    if (!novoTipo) {
      toast.error("Selecione o tipo de contêiner.");
      return;
    }
    const tamanho = formatTamanhoOpcao(novoTam || tamanhosNovo[0] || "20'");
    const dup = matriz.some(
      (m) => m.tipoContainerCodigo === novoTipo && m.containerTamanho === tamanho,
    );
    if (dup) {
      toast.error(`Já existe linha para ${novoTipo} ${tamanho}.`);
      return;
    }
    setMatriz((prev) => [
      ...prev,
      {
        tipoContainerCodigo: novoTipo,
        containerTamanho: tamanho,
        valorHandling: "0",
        diasFreeTime: "0",
        faixasDiaria: [],
      },
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.nome.trim().length < 2) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome,
        descricao: form.descricao || undefined,
        dataInicio: form.dataInicio || undefined,
        dataFim: form.dataFim || undefined,
        ativo: form.ativo,
        padrao: form.padrao,
        itens: matriz.map((m) => ({
          tipoContainerCodigo: m.tipoContainerCodigo,
          containerTamanho: m.containerTamanho,
          diasFreeTime: Number(m.diasFreeTime) || 0,
          valorHandling: parseMoeda(m.valorHandling) || 0,
          faixasDiaria: m.faixasDiaria
            .filter((f) => f.diaInicio && f.valorDiaria)
            .map((f) => ({
              diaInicio: Number(f.diaInicio),
              diaFim: f.diaFim ? Number(f.diaFim) : null,
              valorDiaria: parseMoeda(f.valorDiaria),
            })),
          ativo: true,
        })),
      };
      if (tabelaId) {
        await updateCadastroTabelaAluguel(tabelaId, payload);
        toast.success("Tabela atualizada.");
      } else {
        await createCadastroTabelaAluguel(payload);
        toast.success(isCopia ? "Cópia da tabela cadastrada." : "Tabela criada.");
      }
      router.push("/cadastros/financeiro/aluguel");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;

  return (
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      {isCopia ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Cópia da matriz. Ajuste nome, vigência e as faixas diferentes. Nada é gravado até Salvar.
        </p>
      ) : null}
      <div>
        <h1 className="text-2xl font-bold">
          {tabelaId ? "Editar tabela de aluguel" : isCopia ? "Clonar tabela de aluguel" : "Nova tabela de aluguel"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Handling na saída da unidade e diárias por faixa de dias. Estadia no pátio usa a tabela de
          armazenagem, em outro ID.
        </p>
      </div>

      <FormSection title="Identificação" icon={Container}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Nome" required className="min-w-[16rem] flex-1">
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </FormField>
          <FormField label="Início" size="sm">
            <Input
              type="date"
              value={form.dataInicio}
              onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
            />
          </FormField>
          <FormField label="Fim" size="sm">
            <Input type="date" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} />
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <FormField label="Descrição" className="min-w-[16rem] flex-1">
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.padrao}
              onChange={(e) => setForm({ ...form, padrao: e.target.checked })}
            />
            Tabela padrão do terminal
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativa
          </label>
        </div>
      </FormSection>

      <FormSection title={`Valores por tipo (${matriz.length})`} icon={Layers}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <FormField label="Tipo" className="min-w-[14rem] flex-1">
            <select
              className={SELECT_CLASS}
              value={novoTipo}
              onChange={(e) => {
                const codigo = e.target.value;
                setNovoTipo(codigo);
                const t = tipos.find((x) => x.codigo === codigo);
                const tam = t?.tamanhos[0];
                setNovoTam(tam ? formatTamanhoOpcao(tam) : "20'");
              }}
            >
              <option value="">Selecione</option>
              {tipos.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.codigo} — {t.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Tamanho" size="sm">
            <select className={SELECT_CLASS} value={novoTam} onChange={(e) => setNovoTam(e.target.value)}>
              {tamanhosNovo.map((tam) => (
                <option key={tam} value={tam}>
                  {tam}
                </option>
              ))}
            </select>
          </FormField>
          <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>
        <TabelaAluguelMatrixGrid items={matriz} tipos={tipos} onChange={setMatriz} />
      </FormSection>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/cadastros/financeiro/aluguel")}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar ({matriz.length} itens)
        </Button>
      </div>
    </form>
  );
}
