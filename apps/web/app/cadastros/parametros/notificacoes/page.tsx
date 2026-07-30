"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2, Mail, RefreshCw, Save, Webhook } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useParametrosGerais } from "@/hooks/use-parametros-gerais";
import { canDo, type CadastrosUserContext } from "@/lib/cadastros/permission-matrix";
import {
  revalidateWhatsappTemplates,
  testSlackWebhook,
  type TenantParametrosNotificacoes,
  type WhatsAppTemplateStatus,
} from "@/lib/api/tenant-config-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { ParametrosBreadcrumb, ParametrosTabs } from "../components/parametros-tabs";

const TEMPLATE_STATUS_VARIANT: Record<
  WhatsAppTemplateStatus,
  "aprovado" | "pendente" | "rejeitado" | "neutral"
> = {
  APPROVED: "aprovado",
  PENDING: "pendente",
  REJECTED: "rejeitado",
  DISABLED: "neutral",
};

export default function ParametrosNotificacoesPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user: CadastrosUserContext = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const canEdit = canDo(user, "parametros", "EDIT");

  const { data, loading, update, reload } = useParametrosGerais();
  const [form, setForm] = useState<TenantParametrosNotificacoes | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

  useEffect(() => {
    if (data?.notificacoes) setForm(data.notificacoes);
  }, [data]);

  if (loading || !form) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando parâmetros de notificações…
      </div>
    );
  }

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || form.emailsAlerta.includes(email)) return;
    setForm({ ...form, emailsAlerta: [...form.emailsAlerta, email] });
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    setForm({ ...form, emailsAlerta: form.emailsAlerta.filter((e) => e !== email) });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({ notificacoes: form });
      toast.success("Parâmetros de notificações salvos.");
    } catch {
      toast.error("Erro ao salvar notificações.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!form.webhookSlackUrl?.trim()) {
      toast.error("Informe a URL do webhook antes de testar.");
      return;
    }
    setTestingWebhook(true);
    try {
      const r = await testSlackWebhook(form.webhookSlackUrl.trim());
      if (r.connected) toast.success(r.message);
      else toast.error(r.message);
    } catch {
      toast.error("Falha ao testar webhook.");
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleRevalidateTemplates = async () => {
    setRevalidating(true);
    try {
      const { templates } = await revalidateWhatsappTemplates();
      setForm((prev) => (prev ? { ...prev, templatesWhatsApp: templates } : prev));
      toast.success("Templates WhatsApp revalidados.");
      await reload();
    } catch {
      toast.error("Falha ao revalidar templates.");
    } finally {
      setRevalidating(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <ParametrosBreadcrumb current="Notificações" />
      <div>
        <h1 className="text-2xl font-bold">Parâmetros Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Emails de alerta, webhook Slack/Teams e templates WhatsApp.
        </p>
      </div>
      <ParametrosTabs />

      <FormSection title="Emails de Alerta" icon={Mail}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {form.emailsAlerta.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-sm"
              >
                {email}
                {canEdit ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => removeEmail(email)}
                    aria-label={`Remover ${email}`}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
            {!form.emailsAlerta.length ? (
              <span className="text-sm text-muted-foreground">Nenhum email cadastrado.</span>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="novo@empresa.com.br"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
              />
              <Button type="button" variant="outline" onClick={addEmail}>
                Adicionar
              </Button>
            </div>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Webhook Slack / Discord / Teams" icon={Webhook}>
        <div className="grid grid-cols-1 gap-4">
          <FormField label="URL do webhook">
            <Input
              disabled={!canEdit}
              value={form.webhookSlackUrl ?? ""}
              onChange={(e) => setForm({ ...form, webhookSlackUrl: e.target.value })}
              placeholder="https://hooks.slack.com/services/..."
            />
          </FormField>
          <FormField label="Webhook habilitado">
            <Switch
              disabled={!canEdit}
              checked={form.webhookSlackEnabled}
              onCheckedChange={(v) => setForm({ ...form, webhookSlackEnabled: v })}
            />
          </FormField>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={testingWebhook}
            onClick={() => void handleTestWebhook()}
          >
            {testingWebhook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Testar webhook
          </Button>
        </div>
      </FormSection>

      <FormSection title="Templates WhatsApp" icon={Bell}>
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Template</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {form.templatesWhatsApp.map((t) => (
                  <tr key={t.name} className="border-b border-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{t.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant={TEMPLATE_STATUS_VARIANT[t.status]}>{t.status}</Badge>
                    </td>
                  </tr>
                ))}
                {!form.templatesWhatsApp.length ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-muted-foreground">
                      Nenhum template encontrado. Clique em Revalidar após configurar o WhatsApp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={revalidating}
            onClick={() => void handleRevalidateTemplates()}
          >
            {revalidating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Revalidar templates
          </Button>
        </div>
      </FormSection>

      <FormField label="Debounce de alertas (min)">
        <Input
          type="number"
          min={1}
          max={120}
          disabled={!canEdit}
          className="max-w-xs"
          value={form.debounceAlertasMin}
          onChange={(e) => setForm({ ...form, debounceAlertasMin: Number(e.target.value) })}
        />
      </FormField>

      <Button disabled={!canEdit || saving} onClick={() => void handleSave()}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar
      </Button>
    </div>
  );
}
