"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { IntegracoesConfig, readIntegracaoApiError } from "@/components/super-admin/integracoes-config";
import {
  fetchSaasIntegracoes,
  listSaasTenants,
  patchSaasIntegracoes,
  testSaasIntegracao,
  type SaasIntegracoes,
  type SaasIntegracoesPatch,
  type SaasIntegrationId,
  type SaasTenantRow,
} from "@/lib/api/super-admin-client";
import { toast } from "@/lib/toast";

const SELECT =
  "flex h-10 w-full max-w-md rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white";

export default function SuperAdminIntegracoesPage() {
  const [tenants, setTenants] = useState<SaasTenantRow[]>([]);
  const [tenantId, setTenantId] = useState("default");
  const [data, setData] = useState<SaasIntegracoes | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SaasIntegrationId | null>(null);
  const [testing, setTesting] = useState<SaasIntegrationId | null>(null);

  useEffect(() => {
    void listSaasTenants()
      .then((rows) => {
        setTenants(rows);
        setTenantId((atual) => {
          if (rows.some((t) => t.id === atual)) return atual;
          return rows.find((t) => t.ehBase)?.id ?? rows[0]?.id ?? "default";
        });
      })
      .catch(() => setTenants([]));
  }, []);

  const reload = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const r = await fetchSaasIntegracoes(id);
      setData(r.integracoes);
    } catch (err) {
      setData(null);
      toast.error(readIntegracaoApiError(err) || "Não foi possível carregar as integrações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(tenantId);
  }, [tenantId, reload]);

  const onSave = async (_id: SaasIntegrationId, patch: SaasIntegracoesPatch) => {
    setSaving(_id);
    try {
      const r = await patchSaasIntegracoes(tenantId, patch);
      setData(r.integracoes);
      toast.success("Integração salva.");
    } catch (err) {
      toast.error(readIntegracaoApiError(err));
      throw err;
    } finally {
      setSaving(null);
    }
  };

  const onTest = async (id: SaasIntegrationId) => {
    setTesting(id);
    try {
      const r = await testSaasIntegracao(tenantId, id);
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

  const atual = tenants.find((t) => t.id === tenantId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Integrações do sistema</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Só o Super Admin configura. Funcionários da intranet não veem esta tela. Escolha o
          terminal — o principal é o <span className="font-mono text-zinc-300">default</span>.
        </p>
      </div>

      <label className="block max-w-md text-sm text-zinc-400">
        Terminal
        <select className={`${SELECT} mt-1`} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome} ({t.slug}){t.ehBase ? " — principal" : ""}
            </option>
          ))}
        </select>
      </label>

      {loading || !data ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loading ? `Carregando ${atual?.nome ?? "terminal"}…` : "Sem dados deste terminal."}
        </div>
      ) : (
        <IntegracoesConfig
          key={tenantId}
          data={data}
          saving={saving}
          testing={testing}
          onSave={onSave}
          onTest={onTest}
        />
      )}
    </div>
  );
}
