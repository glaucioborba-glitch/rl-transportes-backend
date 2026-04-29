"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PortalTable } from "@/components/portal/portal-table";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { StatusBadge } from "@/components/portal/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, fetchSolicitacoesPaginated, type SolicitacaoRow } from "@/lib/api/portal-client";
import { formatDateTime, operationTypeLabel } from "@/lib/portal-tracking";
import { toast } from "@/lib/toast";

const STATUSES = ["", "PENDENTE", "APROVADO", "CONCLUIDO", "REJEITADO"];

export default function SolicitacoesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SolicitacaoRow[]>([]);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSolicitacoesPaginated({
        page,
        limit,
        status: status || undefined,
        protocolo: protocolo.trim() || undefined,
        createdFrom: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
        createdTo: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
        orderBy: "createdAt",
        order: "desc",
      });
      const items = (res as { items?: SolicitacaoRow[] }).items ?? [];
      const tot = (res as { total?: number }).total ?? 0;
      setRows(items);
      setTotal(tot);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao listar");
    } finally {
      setLoading(false);
    }
  }, [page, status, protocolo, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <SectionTitle
        title="Solicitações"
        description="GET /cliente/portal/solicitacoes — paginação e filtros no backend (camada CX)."
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Status</label>
              <select
                className="flex h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s || "all"} value={s}>
                    {s || "Todos"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Protocolo (contém)</label>
              <Input
                placeholder="SUFixo ou parte…"
                value={protocolo}
                onChange={(e) => {
                  setProtocolo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Criado a partir</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Criado até</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={() => void load()}>
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardContent className="p-0 pt-4">
            <PortalTable
              columns={[
                { key: "protocolo", header: "Protocolo" },
                { key: "status", header: "Status" },
                { key: "createdAt", header: "Criação" },
                { key: "tipo", header: "Tipo" },
                { key: "nu", header: "Unidades" },
                { key: "act", header: "" },
              ]}
              rows={rows}
              getRowKey={(r) => r.id}
              renderCell={(r, key) => {
                if (key === "protocolo")
                  return <span className="font-mono text-sm text-white">{r.protocolo}</span>;
                if (key === "status") return <StatusBadge status={r.status} />;
                if (key === "createdAt") return formatDateTime(r.createdAt);
                if (key === "tipo") return operationTypeLabel(r);
                if (key === "nu") return String(r.unidades?.length ?? 0);
                if (key === "act")
                  return (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/portal/solicitacoes/${r.id}`}>Abrir</Link>
                    </Button>
                  );
                return null;
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 p-4">
              <p className="text-xs text-slate-500">
                Pág. {page} / {totalPages} · {total} registros
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
