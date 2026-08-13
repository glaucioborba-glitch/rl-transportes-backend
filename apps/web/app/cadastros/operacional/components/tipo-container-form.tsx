"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Loader2, Save, Snowflake, X } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastrosTipoContainer,
  getCadastrosTipoContainer,
  updateCadastrosTipoContainer,
  type CadastrosTipoContainer,
} from "@/lib/api/cadastros-tipos-container-client";
import { toast } from "@/lib/toast";
import {
  TAMANHOS_CONTAINER_OPCOES,
  normalizeTamanhoContainer,
  normalizeTamanhosContainer,
  tamanhoContainerSelecionado,
} from "@/lib/cadastros/tipo-container-tamanhos";

function pickTipoContainerPayload(
  data: Omit<CadastrosTipoContainer, "id"> | CadastrosTipoContainer,
): Omit<CadastrosTipoContainer, "id"> {
  return {
    codigo: data.codigo,
    nome: data.nome,
    tamanhos: normalizeTamanhosContainer(data.tamanhos),
    tomadaReefer: data.tomadaReefer ?? false,
    ativo: data.ativo ?? true,
  };
}

type Props = {
  tipoId?: string;
};

export function TipoContainerForm({ tipoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(tipoId));
  const [formData, setFormData] = useState<Omit<CadastrosTipoContainer, "id">>({
    codigo: "",
    nome: "",
    tamanhos: [],
    tomadaReefer: false,
    ativo: true,
  });

  useEffect(() => {
    if (!tipoId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastrosTipoContainer(tipoId);
        if (on) setFormData(pickTipoContainerPayload(data));
      } catch {
        toast.error("Erro ao carregar tipo.");
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
      const payload = pickTipoContainerPayload(formData);
      if (tipoId) {
        await updateCadastrosTipoContainer(tipoId, payload);
        toast.success("Tipo atualizado!");
      } else {
        await createCadastrosTipoContainer(payload);
        toast.success("Tipo cadastrado!");
      }
      router.push("/cadastros/operacional/tipos-container");
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
      <FormSection title="Tipo de Contêiner" icon={Box}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Código" required>
            <Input
              value={formData.codigo}
              onChange={(e) =>
                setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
              }
              placeholder="Ex: DRY, REEFER, HC"
              className="font-mono"
            />
          </FormField>
          <FormField label="Nome" required>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Dry Container"
            />
          </FormField>
          <FormField label="Tamanhos Aceitos" className="md:col-span-2">
            <div className="flex flex-wrap gap-3">
              {TAMANHOS_CONTAINER_OPCOES.map((tam) => (
                <label key={tam} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={tamanhoContainerSelecionado(formData.tamanhos, tam)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData((prev) => ({
                          ...prev,
                          tamanhos: normalizeTamanhosContainer([...prev.tamanhos, tam]),
                        }));
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          tamanhos: normalizeTamanhosContainer(
                            prev.tamanhos.filter(
                              (t) => normalizeTamanhoContainer(t) !== tam,
                            ),
                          ),
                        }));
                      }
                    }}
                    className="h-4 w-4 rounded border-border"
                  />
                  {tam}&apos;
                </label>
              ))}
            </div>
          </FormField>
          <FormField label="Tomada Reefer">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.tomadaReefer}
                onChange={(e) =>
                  setFormData({ ...formData, tomadaReefer: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              <Snowflake className="h-4 w-4 text-blue-400" />
              Requer tomada reefer no pátio
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
