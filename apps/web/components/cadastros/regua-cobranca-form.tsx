"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Save } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  patchReguaCobranca,
  type ReguaCobrancaConfig,
} from "@/lib/api/tenant-config-client";
import { toast } from "@/lib/toast";

type Props = {
  initial: ReguaCobrancaConfig;
  onSaved?: (regua: ReguaCobrancaConfig) => void;
  disabled?: boolean;
};

export function ReguaCobrancaForm({ initial, onSaved, disabled }: Props) {
  const [form, setForm] = useState<ReguaCobrancaConfig>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  function toggleEtapa(key: keyof NonNullable<ReguaCobrancaConfig["etapas"]>) {
    setForm((prev) => ({
      ...prev,
      etapas: { ...prev.etapas, [key]: !prev.etapas?.[key] },
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await patchReguaCobranca(form);
      setForm(updated.reguaCobranca);
      onSaved?.(updated.reguaCobranca);
      toast.success("Régua de cobrança salva.");
    } catch {
      toast.error("Erro ao salvar régua de cobrança.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-6" id="regua-cobranca">
      <FormSection title="Régua de Cobrança" icon={Mail}>
        <p className="mb-4 text-sm text-muted-foreground">
          Avisos preventivos e de cobrança (WhatsApp e e-mail) antes do bloqueio sistêmico.
        </p>

        <FormField label="Régua automatizada ativa (CRON diário 08:00)">
          <Switch
            checked={form.ativo ?? true}
            onCheckedChange={(v) => setForm({ ...form, ativo: v })}
            disabled={disabled}
          />
        </FormField>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <FormField label="Dias antes do vencimento">
            <Input
              type="number"
              min={1}
              max={30}
              value={form.diasPreVencimento ?? 2}
              disabled={disabled}
              onChange={(e) =>
                setForm({ ...form, diasPreVencimento: Number(e.target.value) || 2 })
              }
            />
          </FormField>
          <FormField label="Dias de atraso (leve)">
            <Input
              type="number"
              min={1}
              max={90}
              value={form.diasAtrasoLeve ?? 3}
              disabled={disabled}
              onChange={(e) =>
                setForm({ ...form, diasAtrasoLeve: Number(e.target.value) || 3 })
              }
            />
          </FormField>
          <FormField label="Dias antes do bloqueio">
            <Input
              type="number"
              min={1}
              max={30}
              value={form.diasPreBloqueio ?? 1}
              disabled={disabled}
              onChange={(e) =>
                setForm({ ...form, diasPreBloqueio: Number(e.target.value) || 1 })
              }
            />
          </FormField>
        </div>

        <div className="mt-4 space-y-3">
          {(
            [
              ["preVencimento", "Pré-vencimento — lembrete amigável"],
              ["vencimentoHoje", "Vencimento hoje"],
              ["atrasoLeve", "Atraso leve — valor com encargos"],
              ["preBloqueio", "Pré-bloqueio — aviso final"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <Switch
                checked={form.etapas?.[key] ?? true}
                onCheckedChange={() => toggleEtapa(key)}
                disabled={disabled}
              />
              {label}
            </label>
          ))}
        </div>

        {!disabled ? (
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar régua
                </>
              )}
            </Button>
          </div>
        ) : null}
      </FormSection>
    </form>
  );
}
