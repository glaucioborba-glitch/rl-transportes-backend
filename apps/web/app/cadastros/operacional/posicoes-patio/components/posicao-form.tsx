"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Save, Snowflake, X } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
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

type Props = { posicaoId?: string };

export function PosicaoForm({ posicaoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(posicaoId));
  const [zonas, setZonas] = useState<CadastroPosicaoPatioZona[]>([]);
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
    restricoes: "",
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
          restricoes: data.restricoes ?? "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.zonaId && !formData.zonaNome) {
      toast.error("Zona é obrigatória.");
      return;
    }
    if (!formData.baiaCodigo || !formData.slotNumero) {
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
      restricoes: formData.restricoes || undefined,
      ativo: formData.ativo,
    };
    try {
      if (posicaoId) {
        await updateCadastroPosicaoPatio(posicaoId, payload as never);
        toast.success("Posição atualizada!");
      } else {
        await createCadastroPosicaoPatio(payload as never);
        toast.success("Posição cadastrada!");
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
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{posicaoId ? "Editar Posição" : "Nova Posição de Pátio"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Estrutura: Zona → Baia → Slot → Stack</p>
      </div>

      <FormSection title="Zona" icon={MapPin}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Zona" required>
            <select
              className={selectClass}
              value={formData.zonaId}
              onChange={(e) => {
                const zona = zonas.find((z) => z.id === e.target.value);
                setFormData({
                  ...formData,
                  zonaId: e.target.value,
                  zonaCodigo: zona?.codigo ?? "",
                  zonaNome: zona?.nome ?? "",
                  zonaCor: zona?.cor ?? "#3B82F6",
                });
              }}
            >
              <option value="">Selecione…</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.codigo} — {z.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Ou criar nova zona">
            <Input
              placeholder="Ex: REEFER, DANGEROSO"
              value={formData.zonaNome}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  zonaNome: e.target.value,
                  zonaCodigo: e.target.value.toUpperCase().substring(0, 5),
                })
              }
            />
          </FormField>
          <FormField label="Cor da Zona">
            <input
              type="color"
              value={formData.zonaCor}
              onChange={(e) => setFormData({ ...formData, zonaCor: e.target.value })}
              className="h-10 w-full rounded border border-border"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Posição" icon={MapPin}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="Código da Baia" required>
            <Input
              value={formData.baiaCodigo}
              onChange={(e) => setFormData({ ...formData, baiaCodigo: e.target.value.toUpperCase() })}
              placeholder="A-01"
              className="font-mono"
            />
          </FormField>
          <FormField label="Número do Slot" required>
            <Input
              type="number"
              value={formData.slotNumero}
              onChange={(e) => setFormData({ ...formData, slotNumero: e.target.value })}
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Altura (Stack)">
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
          <FormField label="Capacidade (t)">
            <Input
              type="number"
              step="0.5"
              value={formData.capacidadePeso}
              onChange={(e) => setFormData({ ...formData, capacidadePeso: e.target.value })}
              className="tabular-nums"
            />
          </FormField>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Tipo Aceito">
            <select
              className={selectClass}
              value={formData.tipoAceito}
              onChange={(e) => setFormData({ ...formData, tipoAceito: e.target.value })}
            >
              <option value="MISTO">Misto</option>
              <option value="DRY">Somente Dry</option>
              <option value="REEFER">Somente Reefer</option>
              <option value="HC">Somente High Cube</option>
            </select>
          </FormField>
          <FormField label="Status">
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
          <FormField label="Tomada Reefer">
            <label className="mt-2 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={formData.tomadaReefer}
                onChange={(e) => setFormData({ ...formData, tomadaReefer: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Snowflake className="h-4 w-4 text-blue-400" />
              <span className="text-sm">Possui tomada reefer</span>
            </label>
          </FormField>
        </div>
        <FormField label="Restrições" className="mt-4">
          <textarea
            value={formData.restricoes}
            onChange={(e) => setFormData({ ...formData, restricoes: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Restrições operacionais…"
          />
        </FormField>
      </FormSection>

      <div className="sticky bottom-0 flex gap-3 border-t border-border bg-background/95 p-4 backdrop-blur">
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
              <Save className="mr-2 h-4 w-4" /> {posicaoId ? "Atualizar" : "Cadastrar"} Posição
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
