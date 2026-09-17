"use client";

import { useState, type ReactNode } from "react";
import {
  Cloud,
  CreditCard,
  Eye,
  Loader2,
  MapPinned,
  MessageCircle,
  Navigation,
  Plug,
  QrCode,
  Save,
  Zap,
} from "lucide-react";
import { FormField } from "@/components/cadastros/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type SaasIntegracaoOrigem,
  type SaasIntegracoes,
  type SaasIntegracoesPatch,
  type SaasIntegrationId,
} from "@/lib/api/super-admin-client";
import { toast } from "@/lib/toast";

const ORIGEM_LABEL: Record<SaasIntegracaoOrigem, string> = {
  env: "Definido no ambiente — a tela não sobrescreve",
  tenant: "Salvo neste terminal",
  none: "Ainda não configurado",
};

export function readIntegracaoApiError(err: unknown): string {
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

type Status = {
  configured?: boolean;
  enabled?: boolean;
  origem?: SaasIntegracaoOrigem;
  lockedByEnv?: boolean;
};

type Props = {
  data: SaasIntegracoes;
  saving: SaasIntegrationId | null;
  testing: SaasIntegrationId | null;
  onSave: (id: SaasIntegrationId, patch: SaasIntegracoesPatch) => Promise<void>;
  onTest: (id: SaasIntegrationId) => Promise<void>;
};

function KeyCard({
  id,
  icon: Icon,
  title,
  description,
  status,
  saving,
  testing,
  onTest,
  onSave,
  children,
}: {
  id: SaasIntegrationId;
  icon: typeof Eye;
  title: string;
  description: string;
  status: Status;
  saving: SaasIntegrationId | null;
  testing: SaasIntegrationId | null;
  onTest: (id: SaasIntegrationId) => Promise<void>;
  onSave: () => void;
  children: ReactNode;
}) {
  const origem = status.origem ?? (status.enabled ? "env" : "none");
  const ok = Boolean(status.configured || status.enabled);
  return (
    <Card className="border-white/10 bg-zinc-900/60">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-violet-400" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Badge variant={ok ? "aprovado" : "rejeitado"}>{ok ? "Configurado" : "Não configurado"}</Badge>
        </div>
        <CardDescription>
          {description}
          <span className="mt-1 block text-xs">{ORIGEM_LABEL[origem]}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={status.lockedByEnv || saving === id} onClick={onSave}>
            {saving === id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
          <Button size="sm" variant="outline" disabled={testing === id} onClick={() => void onTest(id)}>
            {testing === id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Testar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegracoesConfig({ data: i, saving, testing, onSave, onTest }: Props) {
  const [visionKey, setVisionKey] = useState("");
  const [mapsKey, setMapsKey] = useState("");
  const [routesKey, setRoutesKey] = useState("");
  const [pixUrl, setPixUrl] = useState("");
  const [pixToken, setPixToken] = useState("");
  const [pixChave, setPixChave] = useState("");
  const [bolUrl, setBolUrl] = useState("");
  const [bolToken, setBolToken] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waToken, setWaToken] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3Key, setS3Key] = useState("");
  const [s3Secret, setS3Secret] = useState("");

  const saveKey = async (id: SaasIntegrationId, patch: SaasIntegracoesPatch, clear: () => void) => {
    await onSave(id, patch);
    clear();
  };

  const boleto = i.boleto ?? i.banking;
  const routes = i.googleRoutes ?? {
    configured: false,
    enabled: false,
    origem: "none" as const,
    lockedByEnv: false,
    apiKeyPresent: false,
  };

  return (
    <div className="grid gap-4">
      <KeyCard
        id="google-maps"
        icon={MapPinned}
        title="Google Maps JavaScript"
        description="Chave do mapa na intranet (Maps JavaScript API)."
        status={i.googleMaps}
        saving={saving}
        testing={testing}
        onTest={onTest}
        onSave={() => {
          const apiKey = mapsKey.trim();
          if (!apiKey) {
            toast.error(
              i.googleMaps.configured
                ? "Cole uma nova API key para trocar."
                : "Informe a API key do Google Maps.",
            );
            return;
          }
          void saveKey("google-maps", { googleMaps: { apiKey } }, () => setMapsKey(""));
        }}
      >
        <FormField label="API key">
          <Input
            type="password"
            disabled={i.googleMaps.lockedByEnv}
            value={mapsKey}
            onChange={(e) => setMapsKey(e.target.value)}
            placeholder={i.googleMaps.configured ? "Já salvo — cole outra para trocar" : "AIza..."}
            autoComplete="off"
          />
        </FormField>
      </KeyCard>

      <KeyCard
        id="google-routes"
        icon={Navigation}
        title="Google Routes"
        description="Chave da Routes API (ETA até o pátio). É outra chave, distinta do Maps."
        status={routes}
        saving={saving}
        testing={testing}
        onTest={onTest}
        onSave={() => {
          const apiKey = routesKey.trim();
          if (!apiKey) {
            toast.error(
              routes.configured
                ? "Cole uma nova API key para trocar."
                : "Informe a API key do Google Routes.",
            );
            return;
          }
          void saveKey("google-routes", { googleRoutes: { apiKey } }, () => setRoutesKey(""));
        }}
      >
        <FormField label="API key">
          <Input
            type="password"
            disabled={routes.lockedByEnv}
            value={routesKey}
            onChange={(e) => setRoutesKey(e.target.value)}
            placeholder={routes.configured ? "Já salvo — cole outra para trocar" : "AIza..."}
            autoComplete="off"
          />
        </FormField>
      </KeyCard>

      <KeyCard
        id="google-vision"
        icon={Eye}
        title="Google Vision (OCR)"
        description="Chave da Vision API para leitura de documentos no gate."
        status={i.googleVision}
        saving={saving}
        testing={testing}
        onTest={onTest}
        onSave={() => {
          const apiKey = visionKey.trim();
          if (!apiKey) {
            toast.error(
              i.googleVision.configured
                ? "Cole uma nova API key para trocar."
                : "Informe a API key do Google Vision.",
            );
            return;
          }
          void saveKey("google-vision", { googleVision: { apiKey } }, () => setVisionKey(""));
        }}
      >
        <FormField label="API key">
          <Input
            type="password"
            disabled={i.googleVision.lockedByEnv}
            value={visionKey}
            onChange={(e) => setVisionKey(e.target.value)}
            placeholder={i.googleVision.configured ? "Já salvo — cole outra para trocar" : "AIza..."}
            autoComplete="off"
          />
        </FormField>
      </KeyCard>

      <KeyCard
        id="pix"
        icon={QrCode}
        title="PIX"
        description="API própria de cobrança PIX. Independente do boleto."
        status={i.pix}
        saving={saving}
        testing={testing}
        onTest={onTest}
        onSave={() => {
          void saveKey(
            "pix",
            {
              pix: {
                apiBaseUrl: pixUrl.trim() || i.pix.apiBaseUrl || "",
                ...(pixToken.trim() ? { apiToken: pixToken.trim() } : {}),
                ...(pixChave.trim() ? { chavePix: pixChave.trim() } : {}),
              },
            },
            () => {
              setPixToken("");
              setPixChave("");
            },
          );
        }}
      >
        <FormField label="URL da API">
          <Input
            disabled={i.pix.lockedByEnv}
            value={pixUrl || i.pix.apiBaseUrl || ""}
            onChange={(e) => setPixUrl(e.target.value)}
            placeholder="https://pix.exemplo/api"
          />
        </FormField>
        <FormField label="Token / API key">
          <Input
            type="password"
            disabled={i.pix.lockedByEnv}
            value={pixToken}
            onChange={(e) => setPixToken(e.target.value)}
            placeholder={i.pix.apiTokenPresent ? "Já salvo — cole outro para trocar" : "Token da API PIX"}
            autoComplete="off"
          />
        </FormField>
        <FormField label="Chave PIX de recebimento">
          <Input
            disabled={i.pix.lockedByEnv}
            value={pixChave}
            onChange={(e) => setPixChave(e.target.value)}
            placeholder={i.pix.chavePixHint ?? "EVP, CNPJ, e-mail ou celular"}
            autoComplete="off"
          />
        </FormField>
      </KeyCard>

      <KeyCard
        id="boleto"
        icon={CreditCard}
        title="Boleto"
        description="API própria de registro de boletos. Independente do PIX."
        status={boleto}
        saving={saving}
        testing={testing}
        onTest={onTest}
        onSave={() => {
          void saveKey(
            "boleto",
            {
              boleto: {
                apiBaseUrl: bolUrl.trim() || boleto.apiBaseUrl || "",
                ...(bolToken.trim() ? { apiToken: bolToken.trim() } : {}),
              },
            },
            () => setBolToken(""),
          );
        }}
      >
        <FormField label="URL da API">
          <Input
            disabled={boleto.lockedByEnv}
            value={bolUrl || boleto.apiBaseUrl || ""}
            onChange={(e) => setBolUrl(e.target.value)}
            placeholder="https://boleto.exemplo/api"
          />
        </FormField>
        <FormField label="Token / API key">
          <Input
            type="password"
            disabled={boleto.lockedByEnv}
            value={bolToken}
            onChange={(e) => setBolToken(e.target.value)}
            placeholder={boleto.configured ? "Já salvo — cole outro para trocar" : "Token da API de boleto"}
            autoComplete="off"
          />
        </FormField>
      </KeyCard>

      <KeyCard
        id="whatsapp"
        icon={MessageCircle}
        title="WhatsApp Business"
        description="Token e Phone Number ID da Meta Cloud API."
        status={i.whatsapp}
        saving={saving}
        testing={testing}
        onTest={onTest}
        onSave={() => {
          void saveKey(
            "whatsapp",
            {
              whatsapp: {
                enabled: true,
                phoneNumberId: waPhone || i.whatsapp.phoneNumberId || "",
                ...(waToken.trim() ? { accessToken: waToken } : {}),
              },
            },
            () => setWaToken(""),
          );
        }}
      >
        <FormField label="Phone Number ID">
          <Input
            disabled={i.whatsapp.lockedByEnv}
            value={waPhone || i.whatsapp.phoneNumberId || ""}
            onChange={(e) => setWaPhone(e.target.value)}
            placeholder="ID do número na Meta"
          />
        </FormField>
        <FormField label="Access token">
          <Input
            type="password"
            disabled={i.whatsapp.lockedByEnv}
            value={waToken}
            onChange={(e) => setWaToken(e.target.value)}
            placeholder={i.whatsapp.accessTokenPresent ? "Já salvo — cole outro para trocar" : "Token da Meta"}
            autoComplete="off"
          />
        </FormField>
      </KeyCard>

      <KeyCard
        id="s3"
        icon={Cloud}
        title="S3 / Storage"
        description="Chaves de acesso do bucket (fotos, anexos)."
        status={i.s3}
        saving={saving}
        testing={testing}
        onTest={onTest}
        onSave={() => {
          void saveKey(
            "s3",
            {
              s3: {
                bucket: s3Bucket || i.s3.bucket || "",
                endpoint: s3Endpoint || i.s3.endpoint || "",
                ...(s3Key.trim() ? { accessKeyId: s3Key } : {}),
                ...(s3Secret.trim() ? { secretAccessKey: s3Secret } : {}),
              },
            },
            () => {
              setS3Key("");
              setS3Secret("");
            },
          );
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Bucket">
            <Input
              disabled={i.s3.lockedByEnv}
              value={s3Bucket || i.s3.bucket || ""}
              onChange={(e) => setS3Bucket(e.target.value)}
            />
          </FormField>
          <FormField label="Endpoint">
            <Input
              disabled={i.s3.lockedByEnv}
              value={s3Endpoint || i.s3.endpoint || ""}
              onChange={(e) => setS3Endpoint(e.target.value)}
              placeholder="http://localhost:9000"
            />
          </FormField>
          <FormField label="Access key">
            <Input
              disabled={i.s3.lockedByEnv}
              value={s3Key}
              onChange={(e) => setS3Key(e.target.value)}
              placeholder={i.s3.configured ? "Já salvo — informe para trocar" : "Access key"}
              autoComplete="off"
            />
          </FormField>
          <FormField label="Secret key">
            <Input
              type="password"
              disabled={i.s3.lockedByEnv}
              value={s3Secret}
              onChange={(e) => setS3Secret(e.target.value)}
              placeholder={i.s3.configured ? "Já salvo — cole outra para trocar" : "Secret key"}
              autoComplete="off"
            />
          </FormField>
        </div>
      </KeyCard>

      <p className="text-xs text-zinc-500">
        <Plug className="mr-1 inline h-3 w-3" />
        Só chaves e URLs de API. Tokens nunca voltam na leitura. Ambiente, se existir, trava o campo.
      </p>
    </div>
  );
}
