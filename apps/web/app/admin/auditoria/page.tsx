"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Download, Printer } from "lucide-react";
import {
  fetchAuditTrail,
  fetchAuditTrailAcoes,
  fetchAuditTrailUsuarios,
  type AuditTrailItem,
  type AuditTrailQuery,
  type CategoriaAuditLog,
} from "@/lib/api/audit-trail-client";
import { ApiError, staffRequest } from "@/lib/api/staff-client";
import { getApiBase } from "@/lib/api/corporate-auth-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { AuditFiltersDrawer } from "@/components/audit-trail/audit-filters-drawer";
import { AuditTimeline } from "@/components/audit-trail/audit-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TABS: { id: CategoriaAuditLog | "ALL"; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "OPERACIONAL", label: "Operacional (Gate/Pátio)" },
  { id: "FINANCEIRO", label: "Financeiro (Faturas/Bloqueios)" },
  { id: "SEGURANCA", label: "Segurança (Acessos/Senhas)" },
];

export default function AdminAuditoriaPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<CategoriaAuditLog | "ALL">("ALL");
  const [filters, setFilters] = useState<AuditTrailQuery>({ page: 1, limit: 40 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<AuditTrailItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<{ usuarioId: string; usuarioNome: string }[]>([]);
  const [acoes, setAcoes] = useState<string[]>([]);

  const query = useMemo(
    (): AuditTrailQuery => ({
      ...filters,
      q: q.trim() || undefined,
      categoria: tab === "ALL" ? undefined : tab,
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none">
      <div className="print:hidden">
        <h1 className="font-serif text-3xl font-bold text-white">Auditoria</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Linha do tempo narrativa centrada no contêiner — rastreabilidade para operação, financeiro e compliance.
        </p>
      </div>

      <div className="hidden print:block border-b border-zinc-300 pb-4 text-black">
        <h1 className="text-xl font-bold">RL Transportes — Relatório de Auditoria</h1>
        <p className="text-sm text-zinc-600">Terminal · Selo corporativo · {new Date().toLocaleString("pt-BR")}</p>
        <p className="text-xs text-zinc-500">{getApiBase()}</p>
      </div>

      <div className="print:hidden space-y-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Digite o número do Contêiner, Nome do Usuário ou Protocolo"
          className="h-14 border-zinc-700 bg-zinc-900 text-base text-white placeholder:text-zinc-500"
        />

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                tab === t.id
                  ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/30"
                  : "bg-zinc-900 text-zinc-400 hover:text-white",
              )}
            >
              {t.label}
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
        {loading ? "Carregando…" : `${total} evento(s) encontrado(s)`}
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
