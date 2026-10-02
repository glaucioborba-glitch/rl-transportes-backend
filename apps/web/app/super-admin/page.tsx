"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, ExternalLink, Pencil, Search, Trash2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TenantDeleteDialog } from "@/components/super-admin/tenant-delete-dialog";
import { TenantEditDialog } from "@/components/super-admin/tenant-edit-dialog";
import { TenantLocaleFields } from "@/components/super-admin/tenant-locale-fields";
import { CnpjPuxarField, empresaFromReceita } from "@/components/super-admin/cnpj-puxar-field";
import { ApiError } from "@/lib/api/corporate-auth-client";
import {
  createSaasTenant,
  deleteSaasTenant,
  ensureKnownFeatureFlags,
  entrarIntranetTenant,
  listFeatureFlags,
  listSaasTenants,
  patchFeatureFlag,
  patchSaasTenant,
  SAAS_PLANOS,
  type FeatureFlagRow,
  type SaasEmpresaIdentidade,
  type SaasTenantRow,
} from "@/lib/api/super-admin-client";
import { formatCNPJ } from "@/lib/cadastros/formatters";
import { labelIdioma, labelMoeda } from "@/lib/financeiro/format";
import { toast } from "@/lib/toast";

const STATUS_LABEL: Record<SaasTenantRow["status"], string> = {
  ATIVO: "Ativo",
  BLOQUEADO: "Bloqueado",
  SUSPENSO: "Suspenso",
};

const SELECT =
  "flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white";

function nestMessage(err: unknown, fallback: string) {
  if (!(err instanceof ApiError)) return fallback;
  try {
    const j = JSON.parse(err.message) as { message?: string | string[] };
    if (typeof j.message === "string") return j.message;
    if (Array.isArray(j.message)) return j.message.join(" ");
  } catch {
    /* texto puro */
  }
  return err.message || fallback;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function usoResumo(t: SaasTenantRow) {
  const u = t.uso;
  if (!u) return "—";
  return `${u.users} user · ${u.clientes} cliente`;
}

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<SaasTenantRow[]>([]);
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [nome, setNome] = useState("");
  const [plano, setPlano] = useState("STANDARD");
  const [cnpjNovo, setCnpjNovo] = useState("");
  const [empresaNova, setEmpresaNova] = useState<SaasEmpresaIdentidade | undefined>();
  const [moedaNova, setMoedaNova] = useState("BRL");
  const [idiomaNovo, setIdiomaNovo] = useState("pt-BR");
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SaasTenantRow | null>(null);
  const [deleting, setDeleting] = useState<SaasTenantRow | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [t, f] = await Promise.all([listSaasTenants(), listFeatureFlags()]);
      setTenants(t);
      setFlags(f);
    } catch (e) {
      toast.error(nestMessage(e, "Falha ao carregar painel SaaS"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const kpis = useMemo(() => {
    const ativos = tenants.filter((t) => t.status === "ATIVO").length;
    const bloqueados = tenants.filter((t) => t.status !== "ATIVO").length;
    const flagsOn = flags.filter((f) => f.ativo).length;
    return { total: tenants.length, ativos, bloqueados, flagsOn };
  }, [tenants, flags]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.nome.toLowerCase().includes(q) ||
        t.plano.toLowerCase().includes(q) ||
        (t.cnpj ?? "").includes(q.replace(/\D/g, "")),
    );
  }, [tenants, busca]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!slug.trim() || !nome.trim()) {
      toast.error("Informe slug e nome do terminal.");
      return;
    }
    setSaving(true);
    try {
      await createSaasTenant({
        slug: slug.trim(),
        nome: nome.trim(),
        plano: plano.trim() || "STANDARD",
        cnpj: cnpjNovo || undefined,
        empresa: empresaNova,
        moedaCorrente: moedaNova,
        idiomaPadrao: idiomaNovo,
      });
      toast.success("Terminal cadastrado. O CNPJ já aparece em Cadastros → Empresa.");
      setSlug("");
      setNome("");
      setCnpjNovo("");
      setEmpresaNova(undefined);
      setMoedaNova("BRL");
      setIdiomaNovo("pt-BR");
      await reload();
    } catch (err) {
      toast.error(nestMessage(err, "Erro ao cadastrar terminal"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(t: SaasTenantRow) {
    const next = t.status === "ATIVO" ? "BLOQUEADO" : "ATIVO";
    try {
      await patchSaasTenant(t.id, { status: next });
      toast.success(`${t.nome}: ${STATUS_LABEL[next]}`);
      await reload();
    } catch (err) {
      toast.error(nestMessage(err, "Erro ao atualizar status"));
    }
  }

  async function saveEdit(payload: {
    nome: string;
    plano: string;
    status: SaasTenantRow["status"];
    cnpj: string;
    empresa?: SaasEmpresaIdentidade;
    moedaCorrente: string;
    idiomaPadrao: string;
  }) {
    if (!editing) return;
    setSaving(true);
    try {
      await patchSaasTenant(editing.id, payload);
      toast.success("Terminal atualizado.");
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error(nestMessage(err, "Erro ao editar terminal"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteSaasTenant(deleting.id);
      toast.success(`Terminal ${deleting.id} excluído.`);
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error(nestMessage(err, "Não foi possível excluir"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleFlag(flag: FeatureFlagRow) {
    try {
      await patchFeatureFlag(flag.chave, { ativo: !flag.ativo });
      toast.success(`Flag ${flag.chave}: ${!flag.ativo ? "ativa" : "inativa"}`);
      await reload();
    } catch (err) {
      toast.error(nestMessage(err, "Erro ao atualizar flag"));
    }
  }

  async function abrirIntranet(t: SaasTenantRow) {
    setOpeningId(t.id);
    try {
      await entrarIntranetTenant(t.id);
      toast.success(`Intranet de ${t.nome}`);
      window.location.assign("/operador/dashboard");
    } catch (err) {
      toast.error(nestMessage(err, "Não foi possível abrir a intranet"));
      setOpeningId(null);
    }
  }

  async function bootstrapFlags() {
    try {
      const rows = await ensureKnownFeatureFlags();
      setFlags(rows);
      toast.success("Flags do produto disponíveis — começam inativas.");
    } catch (err) {
      toast.error(nestMessage(err, "Não foi possível registrar as flags"));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">Cockpit do dono do software</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Terminais B2B: criar, editar plano, bloquear inadimplente e excluir só o que ainda está
          vazio. O <span className="font-mono text-violet-300">default</span> é a RL e não sai da
          lista. Use <span className="text-zinc-300">Abrir intranet</span> para operar aquele
          terminal com este mesmo login.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Terminais" value={String(kpis.total)} />
        <Kpi label="Ativos" value={String(kpis.ativos)} tom="emerald" />
        <Kpi label="Bloqueados / suspensos" value={String(kpis.bloqueados)} tom="amber" />
        <Kpi label="Flags ativas" value={String(kpis.flagsOn)} tom="violet" />
      </div>

      <Card className="border-violet-500/20 bg-zinc-900/60">
        <CardHeader>
          <CardTitle className="text-white">Novo terminal</CardTitle>
          <CardDescription>
            Cria tenant + configuração. Informe o CNPJ e use Puxar para preencher a ficha em Cadastros →
            Empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="slug (ex: terminal-xpto)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="bg-black/40 font-mono"
            />
            <Input
              placeholder="Nome exibido"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-black/40"
            />
            <select className={SELECT} value={plano} onChange={(e) => setPlano(e.target.value)}>
              {SAAS_PLANOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={saving}>
              {saving && !editing && !deleting ? "Salvando…" : "Cadastrar"}
            </Button>
            <div className="sm:col-span-2 lg:col-span-4">
              <TenantLocaleFields
                moedaCorrente={moedaNova}
                idiomaPadrao={idiomaNovo}
                disabled={saving}
                onMoeda={setMoedaNova}
                onIdioma={setIdiomaNovo}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="mb-1.5 text-xs uppercase tracking-wide text-zinc-500">CNPJ da empresa do terminal</p>
              <CnpjPuxarField
                cnpj={cnpjNovo}
                onCnpj={(d) => {
                  setCnpjNovo(d);
                  setEmpresaNova(undefined);
                }}
                onPuxou={(r) => {
                  const patch = empresaFromReceita(r);
                  setEmpresaNova(patch);
                  setNome(r.razaoSocial.trim() || r.nomeFantasia.trim() || nome);
                }}
                disabled={saving}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/60">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-white">Terminais</CardTitle>
            <CardDescription>{loading ? "Carregando…" : `${filtrados.length} na lista`}</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Buscar slug, nome, plano ou CNPJ"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="bg-black/40 pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Nome</th>
                <th className="pb-2 pr-4">CNPJ</th>
                <th className="pb-2 pr-4">Plano</th>
                <th className="pb-2 pr-4">Moeda</th>
                <th className="pb-2 pr-4">Idioma</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Uso</th>
                <th className="pb-2 pr-4">Desde</th>
                <th className="pb-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 font-mono text-xs text-violet-300">{t.id}</td>
                  <td className="py-3 pr-4">{t.nome}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-zinc-400">
                    {t.cnpj ? formatCNPJ(t.cnpj) : "—"}
                  </td>
                  <td className="py-3 pr-4 text-zinc-300">{t.plano}</td>
                  <td className="py-3 pr-4 text-xs text-zinc-300">{labelMoeda(t.moedaCorrente)}</td>
                  <td className="py-3 pr-4 text-xs text-zinc-300">{labelIdioma(t.idiomaPadrao)}</td>
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
                  <td className="py-3 pr-4 text-xs text-zinc-400">{usoResumo(t)}</td>
                  <td className="py-3 pr-4 text-xs text-zinc-500">{formatDate(t.createdAt)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => void abrirIntranet(t)}
                        disabled={openingId === t.id}
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        {openingId === t.id ? "Abrindo…" : "Abrir intranet"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      {!t.ehBase ? (
                        <Button size="sm" variant="outline" onClick={() => void toggleStatus(t)}>
                          {t.status === "ATIVO" ? (
                            <>
                              <Ban className="mr-1.5 h-3.5 w-3.5" />
                              Bloquear
                            </>
                          ) : (
                            <>
                              <Unlock className="mr-1.5 h-3.5 w-3.5" />
                              Reativar
                            </>
                          )}
                        </Button>
                      ) : (
                        <span className="px-2 text-[11px] uppercase tracking-wide text-zinc-500">Base</span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/30 text-red-300 hover:bg-red-950/40"
                        title={t.bloqueioExclusao ?? "Excluir terminal vazio"}
                        onClick={() => setDeleting(t)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/60">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-white">Feature flags globais</CardTitle>
            <CardDescription>Módulos do produto. Inativo = desligado para todos os terminais.</CardDescription>
          </div>
          {flags.length === 0 && !loading ? (
            <Button type="button" variant="outline" onClick={() => void bootstrapFlags()}>
              Registrar flags do produto
            </Button>
          ) : null}
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
            <p className="text-sm text-zinc-500">
              Nenhuma flag cadastrada. Registre as do produto para ligar NFS-e e demais módulos.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <TenantEditDialog
        tenant={editing}
        open={Boolean(editing)}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={(p) => void saveEdit(p)}
      />
      <TenantDeleteDialog
        tenant={deleting}
        open={Boolean(deleting)}
        saving={saving}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function Kpi({ label, value, tom }: { label: string; value: string; tom?: "emerald" | "amber" | "violet" }) {
  const color =
    tom === "emerald"
      ? "text-emerald-300"
      : tom === "amber"
        ? "text-amber-300"
        : tom === "violet"
          ? "text-violet-300"
          : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
