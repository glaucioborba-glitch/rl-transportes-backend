"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Bell, Loader2, MessageSquare, Save, X } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroMotivoRejeicao,
  getCadastroMotivoRejeicao,
  updateCadastroMotivoRejeicao,
  type CadastroMotivoRejeicao,
} from "@/lib/api/cadastros-motivos-rejeicao-client";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

const TIPOS = [
  { value: "REJEICAO_GATE", label: "Rejeição no Gate" },
  { value: "RETORNO_PATIO", label: "Retorno ao Pátio" },
  { value: "CANCELAMENTO_CLIENTE", label: "Cancelamento do Cliente" },
] as const;

const EMPTY_FORM: Omit<CadastroMotivoRejeicao, "id"> = {
  codigo: "",
  descricao: "",
  tipo: "REJEICAO_GATE",
  exigeObservacao: false,
  notificaCliente: false,
  ativo: true,
};

type Props = {
  motivoId?: string;
};

export function MotivoRejeicaoForm({ motivoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(motivoId));
  const [formData, setFormData] = useState<Omit<CadastroMotivoRejeicao, "id">>(EMPTY_FORM);

  useEffect(() => {
    if (!motivoId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroMotivoRejeicao(motivoId);
        if (on) setFormData(data);
      } catch {
        toast.error("Erro ao carregar motivo de rejeição.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [motivoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo || !formData.descricao) {
      toast.error("Código e Descrição são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      if (motivoId) {
        await updateCadastroMotivoRejeicao(motivoId, formData);
        toast.success("Motivo atualizado!");
      } else {
        await createCadastroMotivoRejeicao(formData);
        toast.success("Motivo cadastrado!");
      }
      router.push("/cadastros/operacional/motivos-rejeicao");
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
      <FormSection title="Motivo de Rejeição" icon={Ban}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Código" required>
            <Input
              value={formData.codigo}
              onChange={(e) =>
                setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
              }
              placeholder="Ex: CNH_VENCIDA"
              className="font-mono"
            />
          </FormField>
          <FormField label="Tipo" required>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className={SELECT_CLASS}
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Descrição" required className="md:col-span-2">
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição exibida ao operador"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Comportamento" icon={MessageSquare}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Exige Observação">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.exigeObservacao}
                onChange={(e) =>
                  setFormData({ ...formData, exigeObservacao: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Operador deve informar observação
            </label>
          </FormField>
          <FormField label="Notifica Cliente">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.notificaCliente}
                onChange={(e) =>
                  setFormData({ ...formData, notificaCliente: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              <Bell className="h-4 w-4 text-muted-foreground" />
              Enviar notificação ao cliente
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
              Motivo ativo
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
              <Save className="mr-2 h-4 w-4" /> {motivoId ? "Atualizar" : "Cadastrar"} Motivo
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
