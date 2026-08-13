"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, Save, Shield } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useParametrosGerais } from "@/hooks/use-parametros-gerais";
import { canDo, type CadastrosUserContext } from "@/lib/cadastros/permission-matrix";
import type { TenantParametrosSeguranca } from "@/lib/api/tenant-config-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { ParametrosBreadcrumb, ParametrosTabs } from "../components/parametros-tabs";

export default function ParametrosSegurancaPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user: CadastrosUserContext = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const canEdit = canDo(user, "parametros", "EDIT");

  const { data, loading, update } = useParametrosGerais();
  const [form, setForm] = useState<TenantParametrosSeguranca | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.seguranca) setForm(data.seguranca);
  }, [data]);

  if (loading || !form) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando parâmetros de segurança…
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({ seguranca: form });
      toast.success("Parâmetros de segurança salvos.");
    } catch {
      toast.error("Erro ao salvar parâmetros de segurança.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <ParametrosBreadcrumb current="Segurança" />
      <div>
        <h1 className="text-2xl font-bold">Parâmetros Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Política de senha, brute-force, sessões e validação de domínio corporativo.
        </p>
      </div>
      <ParametrosTabs />

      <FormSection title="Política de Senha" icon={Lock}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Tamanho mínimo">
            <Input
              type="number"
              min={6}
              max={128}
              disabled={!canEdit}
              value={form.senhaMinLength}
              onChange={(e) => setForm({ ...form, senhaMinLength: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="Exigir maiúscula">
            <Switch
              disabled={!canEdit}
              checked={form.senhaExigirMaiuscula}
              onCheckedChange={(v) => setForm({ ...form, senhaExigirMaiuscula: v })}
            />
          </FormField>
          <FormField label="Exigir número">
            <Switch
              disabled={!canEdit}
              checked={form.senhaExigirNumero}
              onCheckedChange={(v) => setForm({ ...form, senhaExigirNumero: v })}
            />
          </FormField>
          <FormField label="Exigir caractere especial">
            <Switch
              disabled={!canEdit}
              checked={form.senhaExigirEspecial}
              onCheckedChange={(v) => setForm({ ...form, senhaExigirEspecial: v })}
            />
          </FormField>
          <FormField label="Bloquear sequências previsíveis">
            <Switch
              disabled={!canEdit}
              checked={form.senhaBloquearSequencias}
              onCheckedChange={(v) => setForm({ ...form, senhaBloquearSequencias: v })}
            />
          </FormField>
          <FormField label="Validar domínio corporativo (portal)">
            <Switch
              disabled={!canEdit}
              checked={form.validarDominioCorporativo}
              onCheckedChange={(v) => setForm({ ...form, validarDominioCorporativo: v })}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Controle de Acesso" icon={Shield}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Tentativas antes do bloqueio">
            <Input
              type="number"
              min={1}
              max={20}
              disabled={!canEdit}
              value={form.tentativasLoginAntesBloqueio}
              onChange={(e) =>
                setForm({ ...form, tentativasLoginAntesBloqueio: Number(e.target.value) })
              }
            />
          </FormField>
          <FormField label="Duração do bloqueio (min)">
            <Input
              type="number"
              min={1}
              max={1440}
              disabled={!canEdit}
              value={form.duracaoBloqueioMin}
              onChange={(e) => setForm({ ...form, duracaoBloqueioMin: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="Sessões concorrentes máximas">
            <Input
              type="number"
              min={1}
              max={50}
              disabled={!canEdit}
              value={form.sessoesMaximasConcorrentes}
              onChange={(e) =>
                setForm({ ...form, sessoesMaximasConcorrentes: Number(e.target.value) })
              }
            />
          </FormField>
          <FormField label="TTL da sessão (horas)">
            <Input
              type="number"
              min={1}
              max={720}
              disabled={!canEdit}
              value={form.ttlSessaoHoras}
              onChange={(e) => setForm({ ...form, ttlSessaoHoras: Number(e.target.value) })}
            />
          </FormField>
        </div>
      </FormSection>

      <Button disabled={!canEdit || saving} onClick={() => void handleSave()}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar
      </Button>
    </div>
  );
}
