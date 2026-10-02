"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Wrench, X } from "lucide-react";
import { CADASTRO_FORM_CLASS, FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroTabelaServico,
  getCadastroTabelaServico,
  updateCadastroTabelaServico,
} from "@/lib/api/cadastros-tabelas-servicos-client";
import { toast } from "@/lib/toast";

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

export function TabelaServicoForm({ tabelaId }: { tabelaId?: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(tabelaId));
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (!tabelaId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroTabelaServico(tabelaId);
        if (on) {
          setForm({
            nome: data.nome,
            descricao: data.descricao ?? "",
            dataInicio: data.dataInicio,
            dataFim: data.dataFim ?? "",
            ativo: data.ativo,
            padrao: data.padrao,
          });
        }
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
      };
      if (tabelaId) {
        await updateCadastroTabelaServico(tabelaId, payload);
        toast.success("Tabela atualizada.");
      } else {
        const created = await createCadastroTabelaServico(payload);
        toast.success("Tabela criada. Cadastre os serviços.");
        router.push(`/cadastros/financeiro/servicos/${created.id}`);
        return;
      }
      router.push("/cadastros/financeiro/servicos");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;

  return (
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      <div>
        <h1 className="text-2xl font-bold">{tabelaId ? "Editar tabela de serviços" : "Nova tabela de serviços"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A tabela padrão do terminal vale quando o cliente não tem tabela própria.
        </p>
      </div>

      <FormSection title="Identificação" icon={Wrench}>
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

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/cadastros/financeiro/servicos")}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
