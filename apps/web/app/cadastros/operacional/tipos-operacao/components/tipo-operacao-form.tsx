"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Cog, Loader2, Save, X } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroTipoOperacao,
  getCadastroTipoOperacao,
  updateCadastroTipoOperacao,
  type CadastroTipoOperacao,
} from "@/lib/api/cadastros-tipos-operacao-client";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

const DIRECOES = [
  { value: "ENTRADA", label: "Entrada" },
  { value: "SAIDA", label: "Saída" },
  { value: "INTERNA", label: "Interna" },
] as const;

const EMPTY_FORM: Omit<CadastroTipoOperacao, "id"> = {
  codigo: "",
  nome: "",
  descricao: null,
  direcao: "ENTRADA",
  exigeContainer: true,
  exigeCaminhao: true,
  exigeEmpilhadeira: true,
  tempoPadrao: null,
  centroCustoPadrao: null,
  cor: "#3B82F6",
  ativo: true,
};

type Props = {
  tipoId?: string;
};

export function TipoOperacaoForm({ tipoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(tipoId));
  const [formData, setFormData] = useState<Omit<CadastroTipoOperacao, "id">>(EMPTY_FORM);

  useEffect(() => {
    if (!tipoId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroTipoOperacao(tipoId);
        if (on) setFormData(data);
      } catch {
        toast.error("Erro ao carregar tipo de operação.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [tipoId]);

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
        descricao: formData.descricao?.trim() || null,
        centroCustoPadrao: formData.centroCustoPadrao?.trim() || null,
        tempoPadrao:
          formData.tempoPadrao != null && !Number.isNaN(Number(formData.tempoPadrao))
            ? Number(formData.tempoPadrao)
            : null,
      };
      if (tipoId) {
        await updateCadastroTipoOperacao(tipoId, payload);
        toast.success("Tipo de operação atualizado!");
      } else {
        await createCadastroTipoOperacao(payload);
        toast.success("Tipo de operação cadastrado!");
      }
      router.push("/cadastros/operacional/tipos-operacao");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      <FormSection title="Tipo de Operação" icon={Cog}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Código" required>
            <Input
              value={formData.codigo}
              onChange={(e) =>
                setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
              }
              placeholder="Ex: BAIXA, COLETA"
              className="font-mono"
            />
          </FormField>
          <FormField label="Nome" required>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Baixa de Contêiner"
            />
          </FormField>
          <FormField label="Descrição" className="md:col-span-2">
            <Input
              value={formData.descricao ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, descricao: e.target.value || null })
              }
              placeholder="Descrição opcional"
            />
          </FormField>
          <FormField label="Direção" required>
            <select
              value={formData.direcao}
              onChange={(e) => setFormData({ ...formData, direcao: e.target.value })}
              className={SELECT_CLASS}
            >
              {DIRECOES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Cor">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.cor}
                onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded border border-border bg-background"
              />
              <Input
                value={formData.cor}
                onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                placeholder="#3B82F6"
                className="font-mono"
              />
            </div>
          </FormField>
          <FormField label="Tempo Padrão (min)">
            <Input
              type="number"
              min={1}
              value={formData.tempoPadrao ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tempoPadrao: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Ex: 30"
            />
          </FormField>
          <FormField label="Centro de Custo Padrão">
            <Input
              value={formData.centroCustoPadrao ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  centroCustoPadrao: e.target.value || null,
                })
              }
              placeholder="Ex: CC-001"
              className="font-mono"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Requisitos" icon={ArrowLeftRight}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Exige Contêiner">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.exigeContainer}
                onChange={(e) =>
                  setFormData({ ...formData, exigeContainer: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              Operação requer contêiner
            </label>
          </FormField>
          <FormField label="Exige Caminhão">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.exigeCaminhao}
                onChange={(e) =>
                  setFormData({ ...formData, exigeCaminhao: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              Operação requer caminhão
            </label>
          </FormField>
          <FormField label="Exige Empilhadeira">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.exigeEmpilhadeira}
                onChange={(e) =>
                  setFormData({ ...formData, exigeEmpilhadeira: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              Operação requer empilhadeira
            </label>
          </FormField>
          <FormField label="Status">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              Tipo ativo
            </label>
          </FormField>
        </div>
      </FormSection>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> {tipoId ? "Atualizar" : "Cadastrar"} Tipo
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
