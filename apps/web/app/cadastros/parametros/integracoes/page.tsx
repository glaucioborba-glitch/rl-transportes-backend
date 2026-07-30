"use client";

import { useState } from "react";
import {
  Cloud,
  CreditCard,
  Eye,
  Loader2,
  MessageCircle,
  Plug,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useParametrosGerais } from "@/hooks/use-parametros-gerais";
import {
  testTenantIntegration,
  type TenantParametrosIntegracoes,
} from "@/lib/api/tenant-config-client";
import { toast } from "@/lib/toast";
import { ParametrosBreadcrumb, ParametrosTabs } from "../components/parametros-tabs";

type IntegrationId = "whatsapp" | "google-vision" | "banking" | "s3";

const INTEGRATIONS: {
  id: IntegrationId;
  key: keyof TenantParametrosIntegracoes;
  name: string;
  icon: typeof Plug;
  detail: (s: TenantParametrosIntegracoes) => string;
}[] = [
  {
    id: "whatsapp",
    key: "whatsapp",
    name: "WhatsApp Business",
    icon: MessageCircle,
    detail: (i) =>
      i.whatsapp.phoneNumberId
        ? `Phone ID: ${i.whatsapp.phoneNumberId} · ${i.whatsapp.templatesAprovados} template(s) aprovado(s)`
        : "Phone Number ID não configurado",
  },
  {
    id: "google-vision",
    key: "googleVision",
    name: "Google Vision API (OCR)",
    icon: Eye,
    detail: (i) => (i.googleVision.apiKeyPresent ? "API key presente" : "API key ausente"),
  },
  {
    id: "banking",
    key: "banking",
    name: "Banking API (Boletos)",
    icon: CreditCard,
    detail: (i) => `Provider: ${i.banking.provider ?? "—"}`,
  },
  {
    id: "s3",
    key: "s3",
    name: "S3 / Storage",
    icon: Cloud,
    detail: (i) =>
      i.s3.bucket
        ? `Bucket: ${i.s3.bucket}${i.s3.endpoint ? ` · ${i.s3.endpoint}` : ""}`
        : "Bucket não configurado",
  },
];

export default function ParametrosIntegracoesPage() {
  const { data, loading } = useParametrosGerais();
  const [testing, setTesting] = useState<IntegrationId | null>(null);

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

  const integracoes = data.integracoes;

  return (
    <div className="max-w-4xl space-y-6">
      <ParametrosBreadcrumb current="Integrações" />
      <div>
        <h1 className="text-2xl font-bold">Parâmetros Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status das integrações externas (credenciais em variáveis de ambiente). Somente leitura com testes de conectividade.
        </p>
      </div>
      <ParametrosTabs />

      <div className="grid gap-4 md:grid-cols-2">
        {INTEGRATIONS.map(({ id, key, name, icon: Icon, detail }) => {
          const status = integracoes[key];
          const configured = status.enabled;
          return (
            <Card key={id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-[var(--accent)]" />
                    <CardTitle className="text-base">{name}</CardTitle>
                  </div>
                  <Badge variant={configured ? "aprovado" : "rejeitado"}>
                    {configured ? "Configurado" : "Não configurado"}
                  </Badge>
                </div>
                <CardDescription>{detail(integracoes)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testing === id}
                  onClick={() => void handleTest(id)}
                >
                  {testing === id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Testar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        <Plug className="mr-1 inline h-3 w-3" />
        Credenciais (tokens, chaves API, certificados bancários) permanecem em variáveis de ambiente por segurança.
      </p>
    </div>
  );
}
