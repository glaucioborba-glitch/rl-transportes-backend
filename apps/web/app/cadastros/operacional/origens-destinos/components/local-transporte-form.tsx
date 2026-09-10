"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Save, X } from "lucide-react";
import { FormField, FormSection, CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroLocalTransporte,
  getCadastroLocalTransporte,
  TIPOS_LOCAL_TRANSPORTE,
  updateCadastroLocalTransporte,
  type CadastroLocalTransporte,
} from "@/lib/api/cadastros-locais-transporte-client";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

const EMPTY: Omit<CadastroLocalTransporte, "id"> = {
  codigo: "",
  nome: "",
  tipo: "PORTO",
  cidade: "",
  uf: "",
  ativo: true,
};

type Props = { localId?: string };

export function LocalTransporteForm({ localId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(localId));
  const [formData, setFormData] = useState(EMPTY);

  useEffect(() => {
    if (!localId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroLocalTransporte(localId);
        if (on) {
          setFormData({
            codigo: data.codigo,
            nome: data.nome,
            tipo: data.tipo,
            cidade: data.cidade ?? "",
            uf: data.uf ?? "",
            ativo: data.ativo,
          });
        }
      } catch {
        toast.error("Erro ao carregar origem/destino.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [localId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo.trim() || !formData.nome.trim()) {
      toast.error("Código e Nome são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        codigo: formData.codigo.trim().toUpperCase(),
        nome: formData.nome.trim(),
        cidade: formData.cidade?.trim() || null,
        uf: formData.uf?.trim().toUpperCase() || null,
      };
      if (localId) {
        await updateCadastroLocalTransporte(localId, payload);
        toast.success("Origem/destino atualizado.");
      } else {
        await createCadastroLocalTransporte(payload);
        toast.success("Origem/destino cadastrado.");
      }
      router.push("/cadastros/operacional/origens-destinos");
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
      <div>
        <h1 className="text-2xl font-bold">
          {localId ? "Editar origem/destino" : "Nova origem/destino"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pontos usados nas tarifas de transporte. O sentido do trecho não altera o valor.
        </p>
      </div>

      <FormSection title="Local" icon={MapPin}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Código" required size="md">
            <Input
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
              placeholder="Ex: FL, PORTONAVE"
              className="font-mono"
              maxLength={32}
            />
          </FormField>
          <FormField label="Nome" required className="min-w-[14rem] flex-1">
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Portonave"
            />
          </FormField>
          <FormField label="Tipo" className="min-w-[12rem] flex-1">
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className={SELECT_CLASS}
            >
              {TIPOS_LOCAL_TRANSPORTE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Cidade" className="min-w-[10rem] flex-1">
            <Input
              value={formData.cidade ?? ""}
              onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              placeholder="Ex: Navegantes"
            />
          </FormField>
          <FormField label="UF" size="xs">
            <Input
              value={formData.uf ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, uf: e.target.value.toUpperCase().slice(0, 2) })
              }
              placeholder="SC"
              maxLength={2}
              className="font-mono uppercase"
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
            <span className="text-sm">Ativo (disponível para tarifas de transporte)</span>
          </label>
        </FormField>
      </FormSection>

      <div className="flex gap-3">
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
              {localId ? "Atualizar" : "Cadastrar"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
