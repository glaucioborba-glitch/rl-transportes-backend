"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Snowflake, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createSaasTipoContainer,
  getSaasTipoContainer,
  updateSaasTipoContainer,
  type SaasTipoContainer,
} from "@/lib/api/super-admin-client";
import { toast } from "@/lib/toast";
import {
  TAMANHOS_CONTAINER_OPCOES,
  normalizeTamanhoContainer,
  normalizeTamanhosContainer,
  tamanhoContainerSelecionado,
} from "@/lib/cadastros/tipo-container-tamanhos";

function pickPayload(
  data: Omit<SaasTipoContainer, "id"> | SaasTipoContainer,
): Omit<SaasTipoContainer, "id"> {
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

export function SuperAdminTipoContainerForm({ tipoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(tipoId));
  const [formData, setFormData] = useState<Omit<SaasTipoContainer, "id">>({
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
        const data = await getSaasTipoContainer(tipoId);
        if (on) setFormData(pickPayload(data));
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
      const payload = pickPayload(formData);
      if (tipoId) {
        await updateSaasTipoContainer(tipoId, payload);
        toast.success("Tipo atualizado. Todos os terminais passam a ver esta alteração.");
      } else {
        await createSaasTipoContainer(payload);
        toast.success("Tipo cadastrado. Todos os terminais passam a usar este tipo.");
      }
      router.push("/super-admin/tipos-container");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="text-zinc-300">
            Código <span className="text-red-400">*</span>
          </span>
          <Input
            value={formData.codigo}
            onChange={(e) =>
              setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
            }
            placeholder="Ex: DRY, REEFER"
            className="font-mono"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-zinc-300">
            Nome <span className="text-red-400">*</span>
          </span>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Dry"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-zinc-300">Tamanhos aceitos</p>
        <div className="flex flex-wrap gap-4">
          {TAMANHOS_CONTAINER_OPCOES.map((tam) => (
            <label key={tam} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
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
                        prev.tamanhos.filter((t) => normalizeTamanhoContainer(t) !== tam),
                      ),
                    }));
                  }
                }}
                className="h-4 w-4 rounded border-white/20"
              />
              {tam}&apos;
            </label>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={formData.tomadaReefer}
          onChange={(e) => setFormData({ ...formData, tomadaReefer: e.target.checked })}
          className="h-4 w-4 rounded border-white/20"
        />
        <Snowflake className="h-4 w-4 text-blue-400" />
        Requer tomada reefer no pátio
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={formData.ativo}
          onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
          className="h-4 w-4 rounded border-white/20"
        />
        Tipo ativo (aparece nos terminais e no portal)
      </label>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/super-admin/tipos-container")}>
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> {tipoId ? "Atualizar" : "Cadastrar"} tipo
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
