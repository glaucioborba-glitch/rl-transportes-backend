"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Save, Snowflake, X } from "lucide-react";
import { FormField, FormSection, CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroPosicaoPatio,
  getCadastroPosicaoPatio,
  listCadastrosPosicoesPatioZonas,
  updateCadastroPosicaoPatio,
  type CadastroPosicaoPatioZona,
} from "@/lib/api/cadastros-posicoes-patio-client";
import { toast } from "@/lib/toast";

const selectClass =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

const ZONA_NOVA = "__nova__";

type Props = { posicaoId?: string };

export function PosicaoForm({ posicaoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(posicaoId));
  const [zonas, setZonas] = useState<CadastroPosicaoPatioZona[]>([]);
  const [zonaSelect, setZonaSelect] = useState("");
  const [formData, setFormData] = useState({
    zonaId: "",
    zonaCodigo: "",
    zonaNome: "",
    zonaCor: "#3B82F6",
    baiaCodigo: "",
    slotNumero: "1",
    stackAltura: 1,
    tipoAceito: "MISTO",
    tomadaReefer: false,
    capacidadePeso: "",
    status: "LIVRE",
    ativo: true,
  });

  useEffect(() => {
    void listCadastrosPosicoesPatioZonas()
      .then((r) => setZonas(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!posicaoId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroPosicaoPatio(posicaoId);
        if (!on) return;
        setZonaSelect(data.zonaId);
        setFormData({
          zonaId: data.zonaId,
          zonaCodigo: data.zonaCodigo,
          zonaNome: data.zonaNome,
          zonaCor: data.zonaCor,
          baiaCodigo: data.baiaCodigo,
          slotNumero: String(data.slotNumero),
          stackAltura: data.stackAltura,
          tipoAceito: data.tipoAceito,
          tomadaReefer: data.tomadaReefer,
          capacidadePeso: data.capacidadePeso != null ? String(data.capacidadePeso) : "",
          status: data.status,
          ativo: data.ativo,
        });
      } catch {
        toast.error("Erro ao carregar posição.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [posicaoId]);

  function aplicarZona(value: string) {
    setZonaSelect(value);
    if (value === ZONA_NOVA) {
      setFormData({ ...formData, zonaId: "", zonaCodigo: "", zonaNome: "", zonaCor: "#3B82F6" });
      return;
    }
    const zona = zonas.find((z) => z.id === value);
    setFormData({
      ...formData,
      zonaId: value,
      zonaCodigo: zona?.codigo ?? "",
      zonaNome: zona?.nome ?? "",
      zonaCor: zona?.cor ?? "#3B82F6",
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (zonaSelect === ZONA_NOVA) {
      if (!formData.zonaCodigo.trim() || !formData.zonaNome.trim()) {
        toast.error("Informe código e nome da nova zona.");
        return;
      }
    } else if (!formData.zonaId) {
      toast.error("Selecione a zona.");
      return;
    }
    if (!formData.baiaCodigo.trim() || !formData.slotNumero) {
      toast.error("Baia e número do slot são obrigatórios.");
      return;
    }
    setSaving(true);
    const payload = {
      zonaId: formData.zonaId || undefined,
      zonaCodigo: formData.zonaCodigo,
      zonaNome: formData.zonaNome,
      zonaCor: formData.zonaCor,
      baiaCodigo: formData.baiaCodigo,
      slotNumero: parseInt(formData.slotNumero, 10),
      stackAltura: formData.stackAltura,
      tipoAceito: formData.tipoAceito,
      tomadaReefer: formData.tomadaReefer,
      capacidadePeso: formData.capacidadePeso ? parseFloat(formData.capacidadePeso) : undefined,
      status: formData.status,
      ativo: formData.ativo,
    };
    try {
      if (posicaoId) {
        await updateCadastroPosicaoPatio(posicaoId, payload as never);
        toast.success("Posição atualizada.");
      } else {
        await createCadastroPosicaoPatio(payload as never);
        toast.success("Posição cadastrada.");
      }
      router.push("/cadastros/operacional/posicoes-patio");
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
      <div>
        <h1 className="text-2xl font-bold">{posicaoId ? "Editar posição" : "Nova posição"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha a zona, informe a baia e o número do slot.
        </p>
      </div>

      <FormSection title="Onde fica" icon={MapPin}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Zona" required className="min-w-[16rem] flex-1">
            <select className={selectClass} value={zonaSelect} onChange={(e) => aplicarZona(e.target.value)}>
              <option value="">Selecione…</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.codigo} — {z.nome}
                </option>
              ))}
              <option value={ZONA_NOVA}>Criar nova zona…</option>
            </select>
          </FormField>
          {zonaSelect === ZONA_NOVA ? (
            <>
              <FormField label="Código da zona" required size="sm">
                <Input
                  value={formData.zonaCodigo}
                  onChange={(e) =>
                    setFormData({ ...formData, zonaCodigo: e.target.value.toUpperCase().slice(0, 16) })
                  }
                  placeholder="A"
                  className="font-mono"
                />
              </FormField>
              <FormField label="Nome da zona" required className="min-w-[12rem] flex-1">
                <Input
                  value={formData.zonaNome}
                  onChange={(e) => setFormData({ ...formData, zonaNome: e.target.value })}
                  placeholder="Zona A — Dry"
                />
              </FormField>
            </>
          ) : null}
          <FormField label="Baia" required size="sm">
            <Input
              value={formData.baiaCodigo}
              onChange={(e) => setFormData({ ...formData, baiaCodigo: e.target.value.toUpperCase() })}
              placeholder="A-01"
              className="font-mono"
            />
          </FormField>
          <FormField label="Slot" required size="sm">
            <Input
              type="number"
              min={1}
              value={formData.slotNumero}
              onChange={(e) => setFormData({ ...formData, slotNumero: e.target.value })}
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Altura (stack)" size="sm">
            <Input
              type="number"
              min={1}
              max={6}
              value={formData.stackAltura}
              onChange={(e) =>
                setFormData({ ...formData, stackAltura: parseInt(e.target.value, 10) || 1 })
              }
              className="tabular-nums"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Uso" icon={Snowflake}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Tipo aceito" size="md">
            <select
              className={selectClass}
              value={formData.tipoAceito}
              onChange={(e) => setFormData({ ...formData, tipoAceito: e.target.value })}
            >
              <option value="MISTO">Misto</option>
              <option value="DRY">Dry</option>
              <option value="REEFER">Reefer</option>
              <option value="HC">High Cube</option>
            </select>
          </FormField>
          <FormField label="Status" size="md">
            <select
              className={selectClass}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="LIVRE">Livre</option>
              <option value="OCUPADO">Ocupado</option>
              <option value="RESERVADO">Reservado</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
          </FormField>
          <FormField label="Capacidade (t)" size="sm">
            <Input
              type="number"
              step="0.5"
              value={formData.capacidadePeso}
              onChange={(e) => setFormData({ ...formData, capacidadePeso: e.target.value })}
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Tomada reefer">
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.tomadaReefer}
                onChange={(e) => setFormData({ ...formData, tomadaReefer: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              Possui tomada
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> {posicaoId ? "Salvar" : "Cadastrar"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
