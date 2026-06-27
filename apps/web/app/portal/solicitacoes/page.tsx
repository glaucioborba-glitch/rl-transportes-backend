"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SolicitacoesIntentHeader } from "@/components/portal/solicitacoes-intent-header";
import { SolicitacaoCompactCard } from "@/components/portal/solicitacao-compact-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, fetchSolicitacoesPaginated, type SolicitacaoRow } from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";
import { formatContainerISO, stripContainerISO } from "@/utils/containerFormatter";

const STATUSES = ["", "PENDENTE", "APROVADO", "CONCLUIDO", "REJEITADO"];

export default function SolicitacoesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [container, setContainer] = useState("");
  const [booking, setBooking] = useState("");
  const [processo, setProcesso] = useState("");
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
        container: stripContainerISO(container) || undefined,
        booking: booking.trim() || undefined,
        processo: processo.trim() || undefined,
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
  }, [page, status, protocolo, container, booking, processo, from, to]);

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Escolha a intenção operacional — o sistema define automaticamente frota FL ou frota do cliente.
        </p>
        <SolicitacoesIntentHeader onCreated={() => void load()} />
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
              <label className="mb-1 block text-xs text-slate-500">Contêiner (ISO)</label>
              <Input
                placeholder="AAAA 000000-0"
                value={container}
                onChange={(e) => {
                  setContainer(formatContainerISO(e.target.value));
                  setPage(1);
                }}
                className="font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Booking (contém)</label>
              <Input
                placeholder="Nº ou parte…"
                value={booking}
                onChange={(e) => {
                  setBooking(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Processo (contém)</label>
              <Input
                placeholder="Nº ou parte…"
                value={processo}
                onChange={(e) => {
                  setProcesso(e.target.value);
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
      ) : rows.length === 0 ? (
        <Card className="border-white/10 bg-black/20">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            Nenhuma solicitação encontrada com os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <SolicitacaoCompactCard key={row.id} row={row} onChanged={() => void load()} />
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
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
        </div>
      )}
    </main>
  );
}
