"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building, Loader2, Save, X } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroBanco,
  getCadastroBanco,
  updateCadastroBanco,
  type CadastroBanco,
} from "@/lib/api/cadastros-bancos-client";
import { formatCNPJ } from "@/lib/cadastros/formatters";
import { toast } from "@/lib/toast";

const EMPTY: Omit<CadastroBanco, "id" | "contasVinculadas"> = {
  codigo: "",
  nome: "",
  cnpj: "",
  site: "",
  ativo: true,
};

type Props = { bancoId?: string };

export function BancoForm({ bancoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(bancoId));
  const [formData, setFormData] = useState(EMPTY);

  useEffect(() => {
    if (!bancoId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroBanco(bancoId);
        if (on) {
          setFormData({
            codigo: data.codigo,
            nome: data.nome,
            cnpj: data.cnpj ?? "",
            site: data.site ?? "",
            ativo: data.ativo,
          });
        }
      } catch {
        toast.error("Erro ao carregar banco.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [bancoId]);

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
        cnpj: formData.cnpj?.replace(/\D/g, "") || undefined,
        site: formData.site?.trim() || undefined,
      };
      if (bancoId) {
        await updateCadastroBanco(bancoId, payload);
        toast.success("Banco atualizado!");
      } else {
        await createCadastroBanco(payload);
        toast.success("Banco cadastrado!");
      }
      router.push("/cadastros/financeiro/bancos");
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
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bancoId ? "Editar Banco" : "Novo Banco"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Catálogo de instituições financeiras</p>
      </div>

      <FormSection title="Dados do Banco" icon={Building}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Código FEBRABAN" required>
            <Input
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              placeholder="Ex: 001, 237, 341"
              className="font-mono tabular-nums"
              maxLength={5}
            />
          </FormField>
          <FormField label="Nome" required>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Banco do Brasil S.A."
            />
          </FormField>
          <FormField label="CNPJ">
            <Input
              value={formData.cnpj ? formatCNPJ(formData.cnpj) : ""}
              onChange={(e) =>
                setFormData({ ...formData, cnpj: e.target.value.replace(/\D/g, "") })
              }
              placeholder="00.000.000/0000-00"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Site">
            <Input
              value={formData.site ?? ""}
              onChange={(e) => setFormData({ ...formData, site: e.target.value })}
              placeholder="www.banco.com.br"
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
            <span className="text-sm">Banco ativo (disponível para vinculação de contas)</span>
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
              {bancoId ? "Atualizar" : "Cadastrar"} Banco
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
