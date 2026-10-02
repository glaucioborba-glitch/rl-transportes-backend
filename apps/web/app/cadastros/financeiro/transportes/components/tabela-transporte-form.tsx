"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Route, Save, X } from "lucide-react";
import { FormField, FormSection, CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroTabelaTransporte,
  getCadastroTabelaTransporte,
  updateCadastroTabelaTransporte,
} from "@/lib/api/cadastros-tabelas-transporte-client";
import { toast } from "@/lib/toast";

type FormState = {
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  padrao: boolean;
};

const EMPTY_FORM: FormState = {
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

export function TabelaTransporteForm({ tabelaId, duplicarId }: Props) {
  const router = useRouter();
  const origemId = tabelaId ?? duplicarId;
  const isCopia = Boolean(duplicarId) && !tabelaId;
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(origemId));
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!origemId) return;
    let on = true;
    void (async () => {
      try {
        const tab = await getCadastroTabelaTransporte(origemId);
        if (!on) return;
        setFormData({
          nome: isCopia ? nomeCopia(tab.nome) : tab.nome,
          descricao: tab.descricao ?? "",
          dataInicio: tab.dataInicio,
          dataFim: tab.dataFim ?? "",
          ativo: isCopia ? true : tab.ativo,
          padrao: isCopia ? false : (tab.padrao ?? false),
        });
      } catch {
        toast.error("Erro ao carregar tabela de transportes.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [origemId, isCopia]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nome.trim().length < 2) {
      toast.error("Informe o nome da tabela.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || undefined,
        dataInicio: formData.dataInicio || undefined,
        dataFim: formData.dataFim || undefined,
        ativo: formData.ativo,
        padrao: formData.padrao,
        ...(isCopia && duplicarId ? { duplicarDeId: duplicarId } : {}),
      };
      if (tabelaId) {
        await updateCadastroTabelaTransporte(tabelaId, payload);
        toast.success("Tabela de transportes atualizada.");
      } else {
        const created = await createCadastroTabelaTransporte(payload);
        toast.success(isCopia ? "Tabela duplicada." : "Tabela de transportes criada.");
        router.push(`/cadastros/financeiro/transportes/${created.id}`);
        return;
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-40 animate-pulse rounded-lg border border-border bg-card" />;
  }

  return (
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      <FormSection title="Identificação" icon={Route}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Nome" required className="min-w-[16rem] flex-[2]">
            <Input
              value={formData.nome}
              onChange={(e) => setFormData((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Tabela de transportes padrão"
              maxLength={255}
            />
          </FormField>
          <FormField label="Descrição" className="min-w-[14rem] flex-1">
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Opcional"
            />
          </FormField>
          <FormField label="Início da vigência" required size="md">
            <Input
              type="date"
              value={formData.dataInicio}
              onChange={(e) => setFormData((f) => ({ ...f, dataInicio: e.target.value }))}
            />
          </FormField>
          <FormField label="Fim da vigência" size="md">
            <Input
              type="date"
              value={formData.dataFim}
              onChange={(e) => setFormData((f) => ({ ...f, dataFim: e.target.value }))}
            />
          </FormField>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.ativo}
              onChange={(e) => setFormData((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Tabela ativa
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.padrao}
              onChange={(e) => setFormData((f) => ({ ...f, padrao: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Tabela padrão do terminal
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Novos cadastros entram na tabela padrão. A atribuição por cliente fica em Financeiro → Forma e prazo.
        </p>
      </FormSection>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/cadastros/financeiro/transportes")}>
          <X className="mr-2 h-4 w-4" />
          {tabelaId ? "Voltar" : "Cancelar"}
        </Button>
        <Button type="submit" variant="default" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {tabelaId ? "Salvar tabela" : isCopia ? "Duplicar tabela" : "Criar tabela"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
