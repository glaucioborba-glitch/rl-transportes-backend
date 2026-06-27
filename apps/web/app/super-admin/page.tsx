"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createSaasTenant,
  listFeatureFlags,
  listSaasTenants,
  patchFeatureFlag,
  patchSaasTenant,
  type FeatureFlagRow,
  type SaasTenantRow,
} from "@/lib/api/super-admin-client";
import { toast } from "@/lib/toast";

const STATUS_LABEL: Record<SaasTenantRow["status"], string> = {
  ATIVO: "Ativo",
  BLOQUEADO: "Bloqueado",
  SUSPENSO: "Suspenso",
};

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<SaasTenantRow[]>([]);
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [nome, setNome] = useState("");
  const [plano, setPlano] = useState("STANDARD");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [t, f] = await Promise.all([listSaasTenants(), listFeatureFlags()]);
      setTenants(t);
      setFlags(f);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar painel SaaS");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!slug.trim() || !nome.trim()) {
      toast.error("Informe slug e nome do terminal.");
      return;
    }
    setSaving(true);
    try {
      await createSaasTenant({ slug: slug.trim(), nome: nome.trim(), plano: plano.trim() || "STANDARD" });
      toast.success("Terminal cadastrado.");
      setSlug("");
      setNome("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar terminal");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(t: SaasTenantRow) {
    const next = t.status === "ATIVO" ? "BLOQUEADO" : "ATIVO";
    try {
      await patchSaasTenant(t.id, { status: next });
      toast.success(`Terminal ${t.nome}: ${STATUS_LABEL[next]}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status");
    }
  }

  async function toggleFlag(flag: FeatureFlagRow) {
    try {
      await patchFeatureFlag(flag.chave, { ativo: !flag.ativo });
      toast.success(`Flag ${flag.chave}: ${!flag.ativo ? "ativa" : "inativa"}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar flag");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">Cockpit do Dono do Software</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Cadastre terminais B2B, bloqueie inadimplentes e gerencie feature flags globais.
        </p>
      </div>

      <Card className="border-violet-500/20 bg-zinc-900/60">
        <CardHeader>
          <CardTitle className="text-white">Novo terminal</CardTitle>
          <CardDescription>Cria tenant + TenantConfig com turnos e branding padrão.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-4">
            <Input
              placeholder="slug (ex: terminal-xpto)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="bg-black/40"
            />
            <Input
              placeholder="Nome exibido"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-black/40"
            />
            <Input
              placeholder="Plano"
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
              className="bg-black/40"
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Cadastrar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/60">
        <CardHeader>
          <CardTitle className="text-white">Terminais</CardTitle>
          <CardDescription>{loading ? "Carregando…" : `${tenants.length} tenant(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Nome</th>
                <th className="pb-2 pr-4">Plano</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 font-mono text-xs text-violet-300">{t.id}</td>
                  <td className="py-3 pr-4">{t.nome}</td>
                  <td className="py-3 pr-4">{t.plano}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        t.status === "ATIVO"
                          ? "text-emerald-400"
                          : t.status === "SUSPENSO"
                            ? "text-amber-400"
                            : "text-red-400"
                      }
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="py-3">
                    {t.id !== "default" ? (
                      <Button size="sm" variant="outline" onClick={() => void toggleStatus(t)}>
                        {t.status === "ATIVO" ? "Bloquear" : "Reativar"}
                      </Button>
                    ) : (
                      <span className="text-xs text-zinc-500">Tenant base</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/60">
        <CardHeader>
          <CardTitle className="text-white">Feature flags globais</CardTitle>
          <CardDescription>Libere módulos Premium (ex: Torre de Controle BI) por plano/regra.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {flags.map((f) => (
            <div
              key={f.chave}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/30 px-4 py-3"
            >
              <div>
                <p className="font-medium text-white">{f.chave}</p>
                {f.descricao ? <p className="text-xs text-zinc-500">{f.descricao}</p> : null}
              </div>
              <Button size="sm" variant={f.ativo ? "default" : "outline"} onClick={() => void toggleFlag(f)}>
                {f.ativo ? "Ativa" : "Inativa"}
              </Button>
            </div>
          ))}
          {!loading && flags.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma feature flag cadastrada.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
