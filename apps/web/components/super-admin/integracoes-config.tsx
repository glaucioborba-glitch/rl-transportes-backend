"use client";

import { useState, type ReactNode } from "react";
import {
  Building2,
  Cloud,
  CreditCard,
  Eye,
  FileCheck2,
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

type AtivacaoNacional = "DESLIGADO" | "CONTINGENCIA" | "SEMPRE";
type AmbienteNacional = "homologacao" | "producao";

function formatarData(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

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
  const [ipmUrl, setIpmUrl] = useState("");
  const [ipmSenha, setIpmSenha] = useState("");
  const [ipmCnpj, setIpmCnpj] = useState("");
  const [ipmTom, setIpmTom] = useState("");
  const [ipmIbge, setIpmIbge] = useState("");
  const [ipmCertificado, setIpmCertificado] = useState("");
  const [ipmCertificadoNome, setIpmCertificadoNome] = useState("");
  const [ipmCertSenha, setIpmCertSenha] = useState("");
  const [ipmLocal, setIpmLocal] = useState("");
  const [ipmAtividade, setIpmAtividade] = useState("");
  const [ipmItem, setIpmItem] = useState("");
  const [ipmAliquota, setIpmAliquota] = useState("");
  const [nacAtivacao, setNacAtivacao] = useState<AtivacaoNacional>(
    i.nfseNacional?.ativacao ?? "DESLIGADO",
  );
  const [nacAmbiente, setNacAmbiente] = useState<AmbienteNacional>(
    i.nfseNacional?.ambiente ?? "homologacao",
  );
  const [nacCertificado, setNacCertificado] = useState("");
  const [nacCertificadoNome, setNacCertificadoNome] = useState("");
  const [nacSenha, setNacSenha] = useState("");
  const [nacCnpj, setNacCnpj] = useState("");
  const [nacIm, setNacIm] = useState("");
  const [nacIbge, setNacIbge] = useState("");
  const [nacSerie, setNacSerie] = useState("");
  const [nacCodigoServico, setNacCodigoServico] = useState("");
  const [nacAliquota, setNacAliquota] = useState("");

  const lerPfxBase64 = async (file: File): Promise<string | null> => {
    if (file.size > 500_000) {
      toast.error("Certificado acima de 500 KB — confira o arquivo.");
      return null;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binario = "";
    for (let n = 0; n < bytes.length; n += 1) binario += String.fromCharCode(bytes[n]);
    return btoa(binario);
  };

  const carregarCertificado = async (file?: File) => {
    if (!file) return;
    const b64 = await lerPfxBase64(file);
    if (!b64) return;
    setNacCertificado(b64);
    setNacCertificadoNome(file.name);
  };

  const carregarCertificadoIpm = async (file?: File) => {
    if (!file) return;
    const b64 = await lerPfxBase64(file);
    if (!b64) return;
    setIpmCertificado(b64);
    setIpmCertificadoNome(file.name);
  };

  const saveKey = async (id: SaasIntegrationId, patch: SaasIntegracoesPatch, clear: () => void) => {
    await onSave(id, patch);
    clear();
  };

  const boleto = i.boleto ?? i.banking;
  const ipm = i.ipm ?? {
    configured: false,
    enabled: false,
    origem: "none" as const,
    lockedByEnv: false,
    baseUrl: "",
    prestadorCnpj: "",
    prestadorTom: "",
    municipioIbge: "",
    senhaPresente: false,
    certificadoPresente: false,
    certificadoOrigem: "nenhum" as const,
    codigoLocalPrestacao: "",
    codigoAtividade: "",
    codigoItemListaServico: "",
    aliquotaPercent: 2,
    situacaoTributaria: "0",
    tomadorTomFallback: "",
  };
  const nacional = i.nfseNacional ?? {
    configured: false,
    enabled: false,
    origem: "none" as const,
    lockedByEnv: false,
    ativacao: "DESLIGADO" as AtivacaoNacional,
    ambiente: "homologacao" as AmbienteNacional,
    certificadoPresente: false,
    serieDps: "1",
    aliquotaIssPercent: 2,
  };
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
        description="Chave do mapa na intranet. Testar valida a Maps JavaScript API (não a Geocoding). No Google Cloud, ative «Maps JavaScript API» neste projeto."
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

      <KeyCard
        id="ipm"
        icon={Building2}
        title="NFS-e — IPM / prefeitura"
        description="Emissor municipal (Atende.Net). Sem a senha do portal, o fiscal fica em sandbox."
        status={ipm}
        saving={saving}
        testing={testing}
        onTest={onTest}
        onSave={() => {
          void saveKey(
            "ipm",
            {
              ipm: {
                baseUrl: ipmUrl || ipm.baseUrl || "",
                prestadorCnpj: (ipmCnpj || ipm.prestadorCnpj || "").replace(/\D/g, ""),
                prestadorTom: ipmTom || ipm.prestadorTom || "",
                municipioIbge: (ipmIbge || ipm.municipioIbge || "").replace(/\D/g, ""),
                codigoLocalPrestacao: ipmLocal || ipm.codigoLocalPrestacao || "",
                codigoAtividade: ipmAtividade || ipm.codigoAtividade || "",
                codigoItemListaServico: ipmItem || ipm.codigoItemListaServico || "",
                aliquotaPercent: Number(ipmAliquota || ipm.aliquotaPercent || 2),
                ...(ipmSenha ? { senha: ipmSenha } : {}),
                ...(ipmCertificado ? { certificadoPfxBase64: ipmCertificado } : {}),
                ...(ipmCertSenha ? { certificadoSenha: ipmCertSenha } : {}),
              },
            },
            () => {
              setIpmSenha("");
              setIpmCertificado("");
              setIpmCertificadoNome("");
              setIpmCertSenha("");
            },
          );
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="URL do webservice">
            <Input
              disabled={ipm.lockedByEnv}
              value={ipmUrl || ipm.baseUrl || ""}
              onChange={(e) => setIpmUrl(e.target.value)}
              placeholder="https://ws-municipio.atende.net:7443/..."
            />
          </FormField>
          <FormField label="Senha do portal">
            <Input
              type="password"
              disabled={ipm.lockedByEnv}
              value={ipmSenha}
              onChange={(e) => setIpmSenha(e.target.value)}
              placeholder={ipm.senhaPresente ? "Já salva — informe para trocar" : "Senha da prefeitura"}
              autoComplete="new-password"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Sem senha, a emissão fica em sandbox (nota de teste local).
            </p>
            {ipm.senhaPresente && !ipm.lockedByEnv ? (
              <button
                type="button"
                className="mt-1 text-[10px] text-red-400 underline-offset-2 hover:underline"
                onClick={() => {
                  if (!window.confirm("Remover a senha do portal? A emissão volta para sandbox."))
                    return;
                  void saveKey("ipm", { ipm: { senha: "" } }, () => setIpmSenha(""));
                }}
              >
                Remover senha salva
              </button>
            ) : null}
          </FormField>
          <FormField label="CNPJ do prestador">
            <Input
              disabled={ipm.lockedByEnv}
              value={ipmCnpj || ipm.prestadorCnpj || ""}
              onChange={(e) => setIpmCnpj(e.target.value)}
            />
          </FormField>
          <FormField label="Código do município (TOM)">
            <Input
              disabled={ipm.lockedByEnv}
              value={ipmTom || ipm.prestadorTom || ""}
              onChange={(e) => setIpmTom(e.target.value)}
              placeholder="8221"
            />
          </FormField>
          <FormField label="Município (IBGE)">
            <Input
              disabled={ipm.lockedByEnv}
              value={ipmIbge || ipm.municipioIbge || ""}
              onChange={(e) => setIpmIbge(e.target.value)}
              placeholder="4211306"
            />
          </FormField>
          <FormField label="Certificado A1 (.pfx / .p12)">
            <Input
              type="file"
              accept=".pfx,.p12"
              disabled={ipm.lockedByEnv}
              onChange={(e) => void carregarCertificadoIpm(e.target.files?.[0])}
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              {ipmCertificadoNome
                ? `${ipmCertificadoNome} pronto para salvar.`
                : ipm.certificadoOrigem === "tenant"
                  ? "Certificado deste terminal em uso."
                  : ipm.certificadoOrigem === "servidor"
                    ? "Usando o certificado do servidor (.env)."
                    : "Opcional — exigido por algumas prefeituras (mTLS)."}
            </p>
            {ipm.certificadoOrigem === "tenant" && !ipm.lockedByEnv ? (
              <button
                type="button"
                className="mt-1 text-[10px] text-red-400 underline-offset-2 hover:underline"
                onClick={() => {
                  if (!window.confirm("Remover o certificado salvo deste terminal?")) return;
                  void saveKey(
                    "ipm",
                    { ipm: { certificadoPfxBase64: "", certificadoSenha: "" } },
                    () => {
                      setIpmCertificado("");
                      setIpmCertificadoNome("");
                      setIpmCertSenha("");
                    },
                  );
                }}
              >
                Remover certificado salvo
              </button>
            ) : null}
          </FormField>
          <FormField label="Senha do certificado">
            <Input
              type="password"
              disabled={ipm.lockedByEnv}
              value={ipmCertSenha}
              onChange={(e) => setIpmCertSenha(e.target.value)}
              placeholder={ipm.certificadoPresente ? "Já salva — informe para trocar" : "Senha do PFX"}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Código do local de prestação">
            <Input
              disabled={ipm.lockedByEnv}
              value={ipmLocal || ipm.codigoLocalPrestacao || ""}
              onChange={(e) => setIpmLocal(e.target.value)}
            />
          </FormField>
          <FormField label="Código da atividade (CNAE)">
            <Input
              disabled={ipm.lockedByEnv}
              value={ipmAtividade || ipm.codigoAtividade || ""}
              onChange={(e) => setIpmAtividade(e.target.value)}
              placeholder="4930201"
            />
          </FormField>
          <FormField label="Item da lista de serviço">
            <Input
              disabled={ipm.lockedByEnv}
              value={ipmItem || ipm.codigoItemListaServico || ""}
              onChange={(e) => setIpmItem(e.target.value)}
              placeholder="160201"
            />
          </FormField>
          <FormField label="Alíquota ISS (%)">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              disabled={ipm.lockedByEnv}
              value={ipmAliquota || String(ipm.aliquotaPercent ?? 2)}
              onChange={(e) => setIpmAliquota(e.target.value)}
            />
          </FormField>
        </div>
      </KeyCard>

      <KeyCard
        id="nfse-nacional"
        icon={FileCheck2}
        title="NFS-e — Emissor Nacional (gov.br)"
        description="Emite pelo Sistema Nacional quando o IPM da prefeitura cai. Certificado A1 é a chave de acesso."
        status={nacional}
        saving={saving}
        testing={testing}
        onTest={onTest}
        onSave={() => {
          void saveKey(
            "nfse-nacional",
            {
              nfseNacional: {
                ambiente: nacAmbiente,
                ativacao: nacAtivacao,
                cnpjPrestador: (nacCnpj || nacional.cnpjPrestador || "").replace(/\D/g, ""),
                inscricaoMunicipal: nacIm || nacional.inscricaoMunicipal || "",
                municipioIbge: (nacIbge || nacional.municipioIbge || "").replace(/\D/g, ""),
                serieDps: nacSerie || nacional.serieDps || "1",
                codigoTributacaoNacional:
                  nacCodigoServico || nacional.codigoTributacaoNacional || "",
                aliquotaIssPercent: Number(nacAliquota || nacional.aliquotaIssPercent || 2),
                ...(nacCertificado ? { certificadoPfxBase64: nacCertificado } : {}),
                ...(nacSenha ? { certificadoSenha: nacSenha } : {}),
              },
            },
            () => {
              setNacCertificado("");
              setNacCertificadoNome("");
              setNacSenha("");
            },
          );
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Quando usar">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={nacional.lockedByEnv}
              value={nacAtivacao}
              onChange={(e) => setNacAtivacao(e.target.value as AtivacaoNacional)}
            >
              <option value="DESLIGADO">Desligado</option>
              <option value="CONTINGENCIA">Contingência — só se o IPM cair</option>
              <option value="SEMPRE">Sempre — emissor principal</option>
            </select>
          </FormField>
          <FormField label="Ambiente">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={nacional.lockedByEnv}
              value={nacAmbiente}
              onChange={(e) => setNacAmbiente(e.target.value as AmbienteNacional)}
            >
              <option value="homologacao">Produção restrita (teste, sem valor fiscal)</option>
              <option value="producao">Produção (nota válida)</option>
            </select>
          </FormField>
          <FormField label="Certificado A1 (.pfx / .p12)">
            <Input
              type="file"
              accept=".pfx,.p12"
              disabled={nacional.lockedByEnv}
              onChange={(e) => void carregarCertificado(e.target.files?.[0])}
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              {nacCertificadoNome
                ? `${nacCertificadoNome} pronto para salvar.`
                : nacional.certificadoTitular
                  ? `${nacional.certificadoTitular} — vence em ${formatarData(nacional.certificadoValidoAte)} (${nacional.certificadoDiasParaVencer} dia(s)).`
                  : nacional.certificadoPresente
                    ? (nacional.certificadoErro ?? "Certificado salvo.")
                    : "O arquivo fica só no servidor e nunca volta na leitura."}
            </p>
            {nacional.certificadoPresente && !nacional.lockedByEnv ? (
              <button
                type="button"
                className="mt-1 text-[10px] text-red-400 underline-offset-2 hover:underline"
                onClick={() => {
                  if (!window.confirm("Remover o certificado salvo deste terminal?")) return;
                  void saveKey(
                    "nfse-nacional",
                    { nfseNacional: { certificadoPfxBase64: "", certificadoSenha: "" } },
                    () => {
                      setNacCertificado("");
                      setNacCertificadoNome("");
                      setNacSenha("");
                    },
                  );
                }}
              >
                Remover certificado salvo
              </button>
            ) : null}
          </FormField>
          <FormField label="Senha do certificado">
            <Input
              type="password"
              disabled={nacional.lockedByEnv}
              value={nacSenha}
              onChange={(e) => setNacSenha(e.target.value)}
              placeholder={nacional.certificadoPresente ? "Já salva — informe para trocar" : "Senha do PFX"}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="CNPJ do prestador">
            <Input
              disabled={nacional.lockedByEnv}
              value={nacCnpj || nacional.cnpjPrestador || ""}
              onChange={(e) => setNacCnpj(e.target.value)}
              placeholder="00000000000000"
            />
          </FormField>
          <FormField label="Inscrição municipal">
            <Input
              disabled={nacional.lockedByEnv}
              value={nacIm || nacional.inscricaoMunicipal || ""}
              onChange={(e) => setNacIm(e.target.value)}
            />
          </FormField>
          <FormField label="Município (IBGE)">
            <Input
              disabled={nacional.lockedByEnv}
              value={nacIbge || nacional.municipioIbge || ""}
              onChange={(e) => setNacIbge(e.target.value)}
              placeholder="4211306"
            />
          </FormField>
          <FormField label="Série da DPS">
            <Input
              disabled={nacional.lockedByEnv}
              value={nacSerie || nacional.serieDps || "1"}
              onChange={(e) => setNacSerie(e.target.value)}
            />
          </FormField>
          <FormField label="Código de tributação nacional">
            <Input
              disabled={nacional.lockedByEnv}
              value={nacCodigoServico || nacional.codigoTributacaoNacional || ""}
              onChange={(e) => setNacCodigoServico(e.target.value)}
              placeholder="110401 (armazenagem)"
            />
          </FormField>
          <FormField label="Alíquota ISS (%)">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              disabled={nacional.lockedByEnv}
              value={nacAliquota || String(nacional.aliquotaIssPercent ?? 2)}
              onChange={(e) => setNacAliquota(e.target.value)}
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
