"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Save, X } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroPlanoConta,
  getCadastroPlanoConta,
  listCadastrosPlanoContas,
  updateCadastroPlanoConta,
  type CadastroPlanoConta,
} from "@/lib/api/cadastros-plano-contas-client";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

type FormState = {
  codigo: string;
  nome: string;
  natureza: string;
  tipo: string;
  paiId: string;
  descricao: string;
  ativo: boolean;
};

const EMPTY: FormState = {
  codigo: "",
  nome: "",
  natureza: "RECEITA",
  tipo: "ANALITICA",
  paiId: "",
  descricao: "",
  ativo: true,
};

type Props = { contaId?: string };

export function PlanoContasForm({ contaId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(contaId));
  const [pais, setPais] = useState<CadastroPlanoConta[]>([]);
  const [formData, setFormData] = useState<FormState>(EMPTY);

  useEffect(() => {
    void listCadastrosPlanoContas("SINTETICA")
      .then((data) => setPais(data.items ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!contaId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroPlanoConta(contaId);
        if (on) {
          setFormData({
            codigo: data.codigo,
            nome: data.nome,
            natureza: data.natureza,
            tipo: data.tipo,
            paiId: data.paiId ?? "",
            descricao: data.descricao ?? "",
            ativo: data.ativo,
          });
        }
      } catch {
        toast.error("Erro ao carregar conta.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [contaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo || !formData.nome) {
      toast.error("Código e Nome são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        paiId: formData.paiId || undefined,
        descricao: formData.descricao.trim() || undefined,
      };
      if (contaId) {
        await updateCadastroPlanoConta(contaId, payload);
        toast.success("Conta atualizada!");
      } else {
        await createCadastroPlanoConta(payload);
        toast.success("Conta cadastrada!");
      }
      router.push("/cadastros/financeiro/plano-contas");
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
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8">
      <FormSection title="Dados da Conta" icon={BookOpen}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Código" required>
            <Input
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              placeholder="Ex: 1.01.001"
              className="font-mono"
            />
          </FormField>
          <FormField label="Nome" required>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Receita de Movimentação"
            />
          </FormField>
          <FormField label="Natureza">
            <select
              className={SELECT_CLASS}
              value={formData.natureza}
              onChange={(e) => setFormData({ ...formData, natureza: e.target.value })}
            >
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
              <option value="PATRIMONIO">Patrimônio</option>
            </select>
          </FormField>
          <FormField label="Tipo">
            <select
              className={SELECT_CLASS}
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
            >
              <option value="ANALITICA">Analítica (recebe lançamentos)</option>
              <option value="SINTETICA">Sintética (agrupa filhas)</option>
            </select>
          </FormField>
          <FormField label="Conta Pai (opcional)">
            <select
              className={SELECT_CLASS}
              value={formData.paiId}
              onChange={(e) => setFormData({ ...formData, paiId: e.target.value })}
            >
              <option value="">Sem pai (raiz)</option>
              {pais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Descrição" className="md:col-span-2">
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição detalhada da conta"
            />
          </FormField>
        </div>

        <FormField label="Status" className="mt-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm">Conta ativa</span>
          </label>
        </FormField>
      </FormSection>

      <div className="sticky bottom-0 flex gap-3 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
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
              {contaId ? "Atualizar" : "Cadastrar"} Conta
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
