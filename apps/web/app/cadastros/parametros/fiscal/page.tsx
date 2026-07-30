"use client";

import { useEffect, useRef, useState } from "react";
import { FileKey, Loader2, Receipt, Save, Zap } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useParametrosGerais } from "@/hooks/use-parametros-gerais";
import { canDo, type CadastrosUserContext } from "@/lib/cadastros/permission-matrix";
import {
  testTenantIntegration,
  type TenantParametrosFiscal,
} from "@/lib/api/tenant-config-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { ParametrosBreadcrumb, ParametrosTabs } from "../components/parametros-tabs";

const PROVEDORES = [
  { value: "IPM", label: "IPM" },
  { value: "ATENDE_NET", label: "Atende.net" },
  { value: "NONE", label: "Nenhum" },
] as const;

const CERT_STATUS_VARIANT: Record<
  TenantParametrosFiscal["certificadoStatus"],
  "aprovado" | "rejeitado" | "pendente" | "neutral"
> = {
  VALIDO: "aprovado",
  VENCIDO: "rejeitado",
  AUSENTE: "rejeitado",
  DESCONHECIDO: "pendente",
};

const CERT_STATUS_LABEL: Record<TenantParametrosFiscal["certificadoStatus"], string> = {
  VALIDO: "Válido",
  VENCIDO: "Vencido",
  AUSENTE: "Ausente",
  DESCONHECIDO: "Desconhecido",
};

export default function ParametrosFiscalPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user: CadastrosUserContext = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const canEdit = canDo(user, "parametros", "EDIT");

  const { data, loading, update, reload } = useParametrosGerais();
  const [form, setForm] = useState<TenantParametrosFiscal | null>(null);
  const [certSenha, setCertSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingIpm, setTestingIpm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingCert = useRef<{ base64: string; senha?: string } | null>(null);

  useEffect(() => {
    if (data?.fiscal) setForm(data.fiscal);
  }, [data]);

  if (loading || !form) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando parâmetros fiscais…
      </div>
    );
  }

  const handleCertUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result ?? "").split(",")[1] ?? "";
      pendingCert.current = { base64, senha: certSenha || undefined };
      toast.success(`Certificado "${file.name}" pronto para salvar.`);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Parameters<typeof update>[0] = { fiscal: { ...form } };
      if (pendingCert.current) {
        patch.fiscal = {
          ...patch.fiscal,
          certificadoBase64: pendingCert.current.base64,
          certificadoSenha: pendingCert.current.senha ?? certSenha,
        };
        pendingCert.current = null;
      } else if (certSenha.trim()) {
        patch.fiscal = { ...patch.fiscal, certificadoSenha: certSenha };
      }
      await update(patch);
      setCertSenha("");
      toast.success("Parâmetros fiscais salvos.");
      await reload();
    } catch {
      toast.error("Erro ao salvar parâmetros fiscais.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestIpm = async () => {
    setTestingIpm(true);
    try {
      const r = await testTenantIntegration("ipm");
      if (r.connected) {
        toast.success(`${r.message}${r.latency != null ? ` (${r.latency} ms)` : ""}`);
      } else {
        toast.error(r.message);
      }
    } catch {
      toast.error("Falha ao testar conexão IPM.");
    } finally {
      setTestingIpm(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <ParametrosBreadcrumb current="Fiscal" />
      <div>
        <h1 className="text-2xl font-bold">Parâmetros Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          NFS-e, certificado A1 e integração com o provedor municipal.
        </p>
      </div>
      <ParametrosTabs />

      <FormSection title="Configuração NFS-e" icon={Receipt}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Município IBGE" required>
            <Input
              maxLength={7}
              disabled={!canEdit}
              value={form.municipioIbge}
              onChange={(e) => setForm({ ...form, municipioIbge: e.target.value.replace(/\D/g, "") })}
            />
          </FormField>
          <FormField label="Provedor">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={!canEdit}
              value={form.provedor}
              onChange={(e) =>
                setForm({ ...form, provedor: e.target.value as TenantParametrosFiscal["provedor"] })
              }
            >
              {PROVEDORES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Regime tributário">
            <Input
              disabled={!canEdit}
              value={form.regimeTributario}
              onChange={(e) => setForm({ ...form, regimeTributario: e.target.value })}
            />
          </FormField>
          <FormField label="Alíquota ISS padrão (%)">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              disabled={!canEdit}
              value={form.aliquotaIssPadrao}
              onChange={(e) => setForm({ ...form, aliquotaIssPadrao: Number(e.target.value) })}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Certificado A1" icon={FileKey}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={CERT_STATUS_VARIANT[form.certificadoStatus]}>
              {CERT_STATUS_LABEL[form.certificadoStatus]}
            </Badge>
            {form.certificadoValidade ? (
              <span className="text-sm text-muted-foreground">
                Validade: {new Date(form.certificadoValidade).toLocaleDateString("pt-BR")}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Senha do certificado">
              <Input
                type="password"
                disabled={!canEdit}
                value={certSenha}
                onChange={(e) => setCertSenha(e.target.value)}
                placeholder="Informe ao enviar novo .pfx"
              />
            </FormField>
            <FormField label="Upload certificado (.pfx)">
              <input
                ref={fileRef}
                type="file"
                accept=".pfx,.p12"
                disabled={!canEdit}
                className="text-sm"
                onChange={(e) => handleCertUpload(e.target.files?.[0] ?? null)}
              />
            </FormField>
          </div>
        </div>
      </FormSection>

      <div className="flex flex-wrap gap-3">
        <Button disabled={!canEdit || saving} onClick={() => void handleSave()}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
        <Button variant="outline" disabled={testingIpm} onClick={() => void handleTestIpm()}>
          {testingIpm ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          Testar conexão IPM
        </Button>
      </div>
    </div>
  );
}
