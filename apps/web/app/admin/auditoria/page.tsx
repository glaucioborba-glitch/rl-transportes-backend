"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Download, Printer } from "lucide-react";
import {
  fetchAuditTrail,
  fetchAuditTrailAcoes,
  fetchAuditTrailUsuarios,
  type AuditTrailItem,
  type AuditTrailQuery,
} from "@/lib/api/audit-trail-client";
import { ApiError, staffRequest } from "@/lib/api/staff-client";
import { getApiBase } from "@/lib/api/corporate-auth-client";
import { toast } from "@/lib/toast";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { AuditFiltersDrawer } from "@/components/audit-trail/audit-filters-drawer";
import { AuditTimeline } from "@/components/audit-trail/audit-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CLASSIFICACAO_AUDITORIA,
  type ClassificacaoAuditoria,
} from "@/lib/auditoria/classificacao-auditoria";

const CLASSIF_TABS: { id: ClassificacaoAuditoria | "ALL"; label: string }[] = [
  { id: "ALL", label: "Todas" },
  { id: "VERDE", label: "Normais" },
  { id: "AMARELO", label: "Alterações" },
  { id: "VERMELHO", label: "Críticas" },
];

function parseClassificacao(raw: string | null): ClassificacaoAuditoria | "ALL" {
  if (raw === "VERDE" || raw === "AMARELO" || raw === "VERMELHO") return raw;
  return "ALL";
}

function AdminAuditoriaClient() {
  const allowed = useStaffAuthStore((s) => isIntranetGestorRole(s.user?.role));
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseClassificacao(searchParams.get("classificacao"));
  const qFromUrl = searchParams.get("q") ?? "";
  const [q, setQ] = useState(qFromUrl);
  const [filters, setFilters] = useState<AuditTrailQuery>({ page: 1, limit: 40 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<AuditTrailItem[]>([]);
  const [total, setTotal] = useState(0);
  const [resumo, setResumo] = useState({ verde: 0, amarelo: 0, vermelho: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<{ usuarioId: string; usuarioNome: string }[]>([]);
  const [acoes, setAcoes] = useState<string[]>([]);

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  function setTab(next: ClassificacaoAuditoria | "ALL") {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === "ALL") sp.delete("classificacao");
    else sp.set("classificacao", next);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const query = useMemo(
    (): AuditTrailQuery => ({
      ...filters,
      q: q.trim() || undefined,
      classificacao: tab === "ALL" ? undefined : tab,
    }),
    [filters, q, tab],
  );

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const res = await fetchAuditTrail(query);
      setItems(res.items);
      setTotal(res.meta.total);
      setResumo(res.resumo ?? { verde: 0, amarelo: 0, vermelho: 0 });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  }, [allowed, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!allowed) return;
    void Promise.all([fetchAuditTrailUsuarios(), fetchAuditTrailAcoes()])
      .then(([u, a]) => {
        setUsuarios(u);
        setAcoes(a);
      })
      .catch(() => undefined);
  }, [allowed]);

  async function exportCsv() {
    try {
      const params = new URLSearchParams();
      if (query.q) params.set("q", query.q);
      if (query.categoria) params.set("categoria", query.categoria);
      if (query.classificacao) params.set("classificacao", query.classificacao);
      if (query.usuarioId) params.set("usuarioId", query.usuarioId);
      if (query.acao) params.set("acao", query.acao);
      if (query.containerIso) params.set("containerIso", query.containerIso);
      if (query.dataInicio) params.set("dataInicio", query.dataInicio);
      if (query.dataFim) params.set("dataFim", query.dataFim);
      const res = await staffRequest(`/audit-trail/export?${params.toString()}`);
      if (!res.ok) throw new Error("Falha na exportação");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado (CSV/Excel).");
    } catch {
      toast.error("Não foi possível exportar o relatório.");
    }
  }

  function printReport() {
    window.print();
  }

  if (!allowed) {
    return <p className="text-amber-400">Somente gestão (ADMIN / GERENTE).</p>;
  }

  const counts: Record<ClassificacaoAuditoria | "ALL", number> = {
    ALL: resumo.verde + resumo.amarelo + resumo.vermelho,
    VERDE: resumo.verde,
    AMARELO: resumo.amarelo,
    VERMELHO: resumo.vermelho,
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="font-serif text-3xl font-bold text-white">Auditoria gerencial</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Menu único da intranet para a trilha de auditoria. Verde: inclusões, solicitações e
          processos comuns. Laranja: alteração de dado já gravado. Vermelho: senha de gestor,
          faturamento ou mudança de fluxo. Alterações do portal do cliente entram nesta mesma
          trilha, com empresa e operador.
        </p>
      </div>

      <div className="hidden print:block border-b border-zinc-300 pb-4 text-black">
        <h1 className="text-xl font-bold">RL Transportes — Relatório de Auditoria</h1>
        <p className="text-sm text-zinc-600">Terminal · Selo corporativo · {new Date().toLocaleString("pt-BR")}</p>
        <p className="text-xs text-zinc-500">{getApiBase()}</p>
      </div>

      <div className="print:hidden grid gap-3 sm:grid-cols-3">
        {(Object.keys(CLASSIFICACAO_AUDITORIA) as ClassificacaoAuditoria[]).map((id) => {
          const meta = CLASSIFICACAO_AUDITORIA[id];
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(active ? "ALL" : id)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-colors",
                meta.className,
                active ? "ring-1 ring-white/30" : "opacity-80 hover:opacity-100",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">{meta.titulo}</p>
              <p className="mt-1 font-mono text-2xl">{counts[id]}</p>
              <p className="mt-1 text-[11px] leading-snug opacity-80">{meta.descricao}</p>
            </button>
          );
        })}
      </div>

      <div className="print:hidden space-y-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Contêiner, empresa, operador, protocolo, ID ou tabela"
          className="h-14 border-zinc-700 bg-zinc-900 text-base text-white placeholder:text-zinc-500"
        />

        <div className="flex flex-wrap gap-2">
          {CLASSIF_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                tab === t.id
                  ? "bg-white/10 text-white ring-1 ring-white/20"
                  : "bg-zinc-900 text-zinc-400 hover:text-white",
              )}
            >
              {t.label}
              {counts[t.id] ? ` · ${counts[t.id]}` : ""}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="border-zinc-700" onClick={() => setDrawerOpen(true)}>
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          <Button type="button" variant="outline" className="border-zinc-700" onClick={() => void exportCsv()}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel (CSV)
          </Button>
          <Button type="button" variant="outline" className="border-zinc-700" onClick={printReport}>
            <Printer className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <p className="text-xs text-zinc-500 print:hidden">
        {loading ? "Carregando…" : `${total} evento(s) na classificação atual`}
        {q.trim() ? ` · busca “${q.trim()}”` : ""}
      </p>

      <AuditTimeline
        items={items}
        expandedId={expandedId}
        onToggleDetails={(id) => setExpandedId((cur) => (cur === id ? null : id))}
      />

      <AuditFiltersDrawer
        open={drawerOpen}
        filters={filters}
        usuarios={usuarios}
        acoes={acoes}
        onChange={setFilters}
        onClose={() => setDrawerOpen(false)}
        onApply={() => {
          setDrawerOpen(false);
          void load();
        }}
        onClear={() => setFilters({ page: 1, limit: 40 })}
      />
    </div>
  );
}

export default function AdminAuditoriaPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Carregando auditoria…</p>}>
      <AdminAuditoriaClient />
    </Suspense>
  );
}
