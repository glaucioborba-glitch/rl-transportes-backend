"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Forklift, Loader2, Save, Wrench, X } from "lucide-react";
import { FormField, FormSection, CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastrosEquipamento,
  EMPTY_EQUIPAMENTO_FORM,
  getCadastrosEquipamento,
  updateCadastrosEquipamento,
  type CadastrosEquipamentoFormData,
} from "@/lib/api/cadastros-equipamentos-client";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  equipamentoId?: string;
};

export function EquipamentoForm({ equipamentoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(equipamentoId));
  const [formData, setFormData] = useState<CadastrosEquipamentoFormData>(EMPTY_EQUIPAMENTO_FORM);

  useEffect(() => {
    if (!equipamentoId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastrosEquipamento(equipamentoId);
        if (on) setFormData({ ...EMPTY_EQUIPAMENTO_FORM, ...data });
      } catch {
        toast.error("Erro ao carregar equipamento.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [equipamentoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo || !formData.tipo) {
      toast.error("Código e Tipo são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      if (equipamentoId) {
        await updateCadastrosEquipamento(equipamentoId, formData);
        toast.success("Equipamento atualizado!");
      } else {
        await createCadastrosEquipamento(formData);
        toast.success("Equipamento cadastrado!");
      }
      router.push("/cadastros/operacional/equipamentos");
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
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      <p className="text-sm text-muted-foreground">
        O vínculo com o operador é feito no login do operador, não neste cadastro.
      </p>

      <FormSection title="Identificação" icon={Forklift}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Código Interno" required size="md">
            <Input
              value={formData.codigo}
              onChange={(e) =>
                setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
              }
              placeholder="EMP-01"
              className="font-mono"
            />
          </FormField>
          <FormField label="Tipo" required className="min-w-[14rem] flex-1">
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="EMPILHADEIRA_FRONTAL">Empilhadeira Frontal</option>
              <option value="REACH_STACKER">Reach Stacker</option>
              <option value="RTG">RTG (Rubber Tyred Gantry)</option>
              <option value="GUINDASTE_MOBILE">Guindaste Móvel</option>
              <option value="EMPILHADEIRA_LATERAL">Empilhadeira Lateral</option>
            </select>
          </FormField>
          <FormField label="Status" size="md">
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="DISPONIVEL">Disponível</option>
              <option value="EM_USO">Em Uso</option>
              <option value="EM_MANUTENCAO">Em Manutenção</option>
              <option value="INATIVO">Inativo</option>
            </select>
          </FormField>
          <FormField label="Marca" className="min-w-[10rem] flex-1">
            <Input
              value={formData.marca}
              onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
              placeholder="Ex: Toyota, Kalmar"
            />
          </FormField>
          <FormField label="Modelo" className="min-w-[10rem] flex-1">
            <Input
              value={formData.modelo}
              onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
              placeholder="Ex: 8FDU15"
            />
          </FormField>
          <FormField label="Centro de Custo" size="md">
            <Input
              value={formData.centroCusto}
              onChange={(e) => setFormData({ ...formData, centroCusto: e.target.value })}
              placeholder="Ex: CC-OP"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Especificações Técnicas" icon={Wrench}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Capacidade Máxima (t)" size="sm">
            <Input
              type="number"
              step="0.5"
              value={formData.capacidade}
              onChange={(e) => setFormData({ ...formData, capacidade: e.target.value })}
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Altura Máxima (m)" size="sm">
            <Input
              type="number"
              step="0.1"
              value={formData.alturaMaxima}
              onChange={(e) => setFormData({ ...formData, alturaMaxima: e.target.value })}
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Horímetro Atual (h)" size="sm">
            <Input
              type="number"
              value={formData.horimetro}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  horimetro: parseInt(e.target.value, 10) || 0,
                })
              }
              className="tabular-nums"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Observações" icon={Wrench}>
        <textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Avarias, reparos realizados, restrições de uso..."
          rows={4}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </FormSection>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={formData.ativo}
          onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
        Equipamento ativo
      </label>

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
              <Save className="mr-2 h-4 w-4" />{" "}
              {equipamentoId ? "Atualizar" : "Cadastrar"} Equipamento
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
