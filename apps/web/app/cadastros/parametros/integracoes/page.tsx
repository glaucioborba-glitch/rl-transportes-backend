"use client";

import { useRef, useState } from "react";
import {
  Cloud,
  CreditCard,
  Eye,
  Loader2,
  MessageCircle,
  Plug,
  Save,
  Zap,
} from "lucide-react";
import { FormField } from "@/components/cadastros/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useParametrosGerais } from "@/hooks/use-parametros-gerais";
import { canDo, type CadastrosUserContext } from "@/lib/cadastros/permission-matrix";
import {
  testTenantIntegration,
  type IntegracaoOrigem,
  type TenantParametrosIntegracoes,
} from "@/lib/api/tenant-config-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { ParametrosBreadcrumb, ParametrosTabs } from "../components/parametros-tabs";

type IntegrationId = "whatsapp" | "google-vision" | "banking" | "s3";

const ORIGEM_LABEL: Record<IntegracaoOrigem, string> = {
  env: "Definido no ambiente — a tela não sobrescreve",
  tenant: "Salvo neste terminal",
  none: "Ainda não configurado",
};

function origemOf(
  status: TenantParametrosIntegracoes[keyof TenantParametrosIntegracoes],
): IntegracaoOrigem {
  return status.origem ?? (status.enabled ? "env" : "none");
}

function readApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(" ");
    if (parsed.message) return parsed.message;
  } catch {
    /* texto cru */
  }
  return raw || "Erro ao salvar integração.";
}

const textareaClass =
  "min-h-[140px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50";

export default function ParametrosIntegracoesPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user: CadastrosUserContext = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const canEdit = canDo(user, "parametros", "EDIT");
  const { data, loading, update, reload } = useParametrosGerais();

  const [testing, setTesting] = useState<IntegrationId | null>(null);
  const [saving, setSaving] = useState<IntegrationId | null>(null);

  const [visionJson, setVisionJson] = useState("");
  const [visionApiKey, setVisionApiKey] = useState("");
  const [waEnabled, setWaEnabled] = useState<boolean | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [waWaba, setWaWaba] = useState("");
  const [waToken, setWaToken] = useState("");
  const [bankProvider, setBankProvider] = useState("");
  const [bankUrl, setBankUrl] = useState("");
  const [bankToken, setBankToken] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3Region, setS3Region] = useState("");
  const [s3Key, setS3Key] = useState("");
  const [s3Secret, setS3Secret] = useState("");
  const visionFileRef = useRef<HTMLInputElement>(null);

  const handleTest = async (id: IntegrationId) => {
    setTesting(id);
    try {
      const r = await testTenantIntegration(id);
      if (r.connected) {
        toast.success(`${r.message}${r.latency != null ? ` (${r.latency} ms)` : ""}`);
      } else {
        toast.error(r.message);
      }
    } catch {
      toast.error("Falha ao testar integração.");
    } finally {
      setTesting(null);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando status das integrações…
      </div>
    );
  }

  const i = data.integracoes;
  const waOn = waEnabled ?? Boolean(i.whatsapp.enabled || i.whatsapp.configured);

  const save = async (id: IntegrationId, patch: Parameters<typeof update>[0]["integracoes"]) => {
    if (!canEdit) return;
    setSaving(id);
    try {
      await update({ integracoes: patch });
      toast.success("Integração salva.");
      if (id === "google-vision") {
        setVisionJson("");
        setVisionApiKey("");
      }
      if (id === "whatsapp") setWaToken("");
      if (id === "banking") setBankToken("");
      if (id === "s3") {
        setS3Key("");
        setS3Secret("");
      }
      await reload();
    } catch (err) {
      toast.error(readApiError(err));
    } finally {
      setSaving(null);
    }
  };

  const readVisionFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setVisionJson(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <ParametrosBreadcrumb current="Integrações" />
      <div>
        <h1 className="text-2xl font-bold">Parâmetros Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure as integrações neste terminal. Variáveis de ambiente, se existirem, continuam
          valendo e travam o campo correspondente.
        </p>
      </div>
      <ParametrosTabs />

      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-[var(--accent)]" />
                <CardTitle className="text-base">Google Vision API (OCR)</CardTitle>
              </div>
              <Badge variant={i.googleVision.configured || i.googleVision.enabled ? "aprovado" : "rejeitado"}>
                {i.googleVision.configured || i.googleVision.enabled ? "Configurado" : "Não configurado"}
              </Badge>
            </div>
            <CardDescription>
              {i.googleVision.clientEmail
                ? `Conta: ${i.googleVision.clientEmail}`
                : "Cole a API key da Vision ou o JSON da service account."}
              <span className="mt-1 block text-xs">{ORIGEM_LABEL[origemOf(i.googleVision)]}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="API key da Vision">
              <Input
                type="password"
                disabled={!canEdit || i.googleVision.lockedByEnv}
                value={visionApiKey}
                onChange={(e) => setVisionApiKey(e.target.value)}
                placeholder={
                  i.googleVision.configured
                    ? "Já salvo — cole outra para trocar"
                    : "AIza..."
                }
                autoComplete="off"
              />
            </FormField>
            <FormField label="Ou JSON da service account">
              <textarea
                className={textareaClass}
                disabled={!canEdit || i.googleVision.lockedByEnv}
                value={visionJson}
                onChange={(e) => setVisionJson(e.target.value)}
                placeholder={
                  i.googleVision.configured
                    ? "Já salvo — cole outro JSON para trocar"
                    : '{"type":"service_account","client_email":"...","private_key":"..."}'
                }
                spellCheck={false}
              />
            </FormField>
            <FormField label="Ou envie o arquivo .json">
              <input
                ref={visionFileRef}
                type="file"
                accept="application/json,.json"
                disabled={!canEdit || i.googleVision.lockedByEnv}
                className="text-sm"
                onChange={(e) => readVisionFile(e.target.files?.[0] ?? null)}
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!canEdit || i.googleVision.lockedByEnv || saving === "google-vision"}
                onClick={() => {
                  const json = visionJson.trim();
                  const key = visionApiKey.trim();
                  if (!json && !key) {
                    toast.error("Cole a API key ou o JSON da service account.");
                    return;
                  }
                  void save("google-vision", {
                    googleVision: {
                      ...(json ? { credentialsJson: json } : {}),
                      ...(key ? { apiKey: key } : {}),
                    },
                  });
                }}
              >
                {saving === "google-vision" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
              {i.googleVision.origem === "tenant" && !i.googleVision.lockedByEnv ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canEdit || saving === "google-vision"}
                  onClick={() => void save("google-vision", { googleVision: { credentialsJson: "" } })}
                >
                  Remover
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={testing === "google-vision"}
                onClick={() => void handleTest("google-vision")}
              >
                {testing === "google-vision" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[var(--accent)]" />
                <CardTitle className="text-base">WhatsApp Business</CardTitle>
              </div>
              <Badge variant={i.whatsapp.configured ? "aprovado" : "rejeitado"}>
                {i.whatsapp.configured ? "Configurado" : "Não configurado"}
              </Badge>
            </div>
            <CardDescription>
              {i.whatsapp.phoneNumberId
                ? `Phone ID: ${i.whatsapp.phoneNumberId} · ${i.whatsapp.templatesAprovados} template(s)`
                : "Phone Number ID e token da Meta Cloud API."}
              <span className="mt-1 block text-xs">{ORIGEM_LABEL[origemOf(i.whatsapp)]}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">Habilitar envio</span>
              <Switch
                checked={waOn}
                disabled={!canEdit || i.whatsapp.lockedByEnv}
                onCheckedChange={setWaEnabled}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Phone Number ID">
                <Input
                  disabled={!canEdit || i.whatsapp.lockedByEnv}
                  value={waPhone || i.whatsapp.phoneNumberId || ""}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="ID do número na Meta"
                />
              </FormField>
              <FormField label="Business Account ID">
                <Input
                  disabled={!canEdit || i.whatsapp.lockedByEnv}
                  value={waWaba}
                  onChange={(e) => setWaWaba(e.target.value)}
                  placeholder={
                    i.whatsapp.businessAccountIdPresent ? "Já salvo — informe para trocar" : "WABA ID"
                  }
                />
              </FormField>
            </div>
            <FormField label="Access token">
              <Input
                type="password"
                disabled={!canEdit || i.whatsapp.lockedByEnv}
                value={waToken}
                onChange={(e) => setWaToken(e.target.value)}
                placeholder={
                  i.whatsapp.accessTokenPresent ? "Já salvo — cole outro para trocar" : "Token da Meta"
                }
                autoComplete="off"
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!canEdit || i.whatsapp.lockedByEnv || saving === "whatsapp"}
                onClick={() =>
                  void save("whatsapp", {
                    whatsapp: {
                      enabled: waOn,
                      phoneNumberId: waPhone || i.whatsapp.phoneNumberId || "",
                      ...(waWaba.trim() ? { businessAccountId: waWaba } : {}),
                      ...(waToken.trim() ? { accessToken: waToken } : {}),
                    },
                  })
                }
              >
                {saving === "whatsapp" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={testing === "whatsapp"}
                onClick={() => void handleTest("whatsapp")}
              >
                {testing === "whatsapp" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[var(--accent)]" />
                <CardTitle className="text-base">Banking API (Boletos)</CardTitle>
              </div>
              <Badge variant={i.banking.configured ? "aprovado" : "rejeitado"}>
                {i.banking.configured ? "Configurado" : "Não configurado"}
              </Badge>
            </div>
            <CardDescription>
              Provider: {i.banking.provider ?? "sandbox"}
              {i.banking.apiBaseUrl ? ` · ${i.banking.apiBaseUrl}` : ""}
              <span className="mt-1 block text-xs">{ORIGEM_LABEL[origemOf(i.banking)]}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Provider">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={!canEdit || i.banking.lockedByEnv}
                  value={bankProvider || i.banking.provider || "sandbox"}
                  onChange={(e) => setBankProvider(e.target.value)}
                >
                  <option value="sandbox">sandbox</option>
                  <option value="api">api</option>
                </select>
              </FormField>
              <FormField label="URL da API">
                <Input
                  disabled={!canEdit || i.banking.lockedByEnv}
                  value={bankUrl || i.banking.apiBaseUrl || ""}
                  onChange={(e) => setBankUrl(e.target.value)}
                  placeholder="https://banco.exemplo/api"
                />
              </FormField>
            </div>
            <FormField label="Token">
              <Input
                type="password"
                disabled={!canEdit || i.banking.lockedByEnv}
                value={bankToken}
                onChange={(e) => setBankToken(e.target.value)}
                placeholder={i.banking.configured ? "Já salvo — cole outro para trocar" : "Token da API bancária"}
                autoComplete="off"
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!canEdit || i.banking.lockedByEnv || saving === "banking"}
                onClick={() =>
                  void save("banking", {
                    banking: {
                      provider: bankProvider || i.banking.provider || "sandbox",
                      apiBaseUrl: bankUrl || i.banking.apiBaseUrl || "",
                      ...(bankToken.trim() ? { apiToken: bankToken } : {}),
                    },
                  })
                }
              >
                {saving === "banking" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={testing === "banking"}
                onClick={() => void handleTest("banking")}
              >
                {testing === "banking" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-[var(--accent)]" />
                <CardTitle className="text-base">S3 / Storage</CardTitle>
              </div>
              <Badge variant={i.s3.configured || i.s3.enabled ? "aprovado" : "rejeitado"}>
                {i.s3.configured || i.s3.enabled ? "Configurado" : "Não configurado"}
              </Badge>
            </div>
            <CardDescription>
              {i.s3.bucket
                ? `Bucket: ${i.s3.bucket}${i.s3.endpoint ? ` · ${i.s3.endpoint}` : ""}`
                : "Bucket, endpoint e chaves de acesso."}
              <span className="mt-1 block text-xs">{ORIGEM_LABEL[origemOf(i.s3)]}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Bucket">
                <Input
                  disabled={!canEdit || i.s3.lockedByEnv}
                  value={s3Bucket || i.s3.bucket || ""}
                  onChange={(e) => setS3Bucket(e.target.value)}
                />
              </FormField>
              <FormField label="Endpoint">
                <Input
                  disabled={!canEdit || i.s3.lockedByEnv}
                  value={s3Endpoint || i.s3.endpoint || ""}
                  onChange={(e) => setS3Endpoint(e.target.value)}
                  placeholder="http://localhost:9000"
                />
              </FormField>
              <FormField label="Região">
                <Input
                  disabled={!canEdit || i.s3.lockedByEnv}
                  value={s3Region || i.s3.region || ""}
                  onChange={(e) => setS3Region(e.target.value)}
                  placeholder="us-east-1"
                />
              </FormField>
              <FormField label="Access key">
                <Input
                  disabled={!canEdit || i.s3.lockedByEnv}
                  value={s3Key}
                  onChange={(e) => setS3Key(e.target.value)}
                  placeholder={i.s3.configured ? "Já salvo — informe para trocar" : "Access key"}
                  autoComplete="off"
                />
              </FormField>
            </div>
            <FormField label="Secret key">
              <Input
                type="password"
                disabled={!canEdit || i.s3.lockedByEnv}
                value={s3Secret}
                onChange={(e) => setS3Secret(e.target.value)}
                placeholder={i.s3.configured ? "Já salvo — cole outra para trocar" : "Secret key"}
                autoComplete="off"
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!canEdit || i.s3.lockedByEnv || saving === "s3"}
                onClick={() =>
                  void save("s3", {
                    s3: {
                      bucket: s3Bucket || i.s3.bucket || "",
                      endpoint: s3Endpoint || i.s3.endpoint || "",
                      region: s3Region || i.s3.region || "",
                      ...(s3Key.trim() ? { accessKeyId: s3Key } : {}),
                      ...(s3Secret.trim() ? { secretAccessKey: s3Secret } : {}),
                    },
                  })
                }
              >
                {saving === "s3" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={testing === "s3"}
                onClick={() => void handleTest("s3")}
              >
                {testing === "s3" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        <Plug className="mr-1 inline h-3 w-3" />
        Tokens e JSON nunca voltam na API. Ambiente (Docker/AWS) vence o que estiver salvo na tela.
      </p>
    </div>
  );
}
