"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { StatusBadge } from "@/components/portal/status-badge";
import { ApiError, fetchSolicitacoesPaginated, type SolicitacaoRow } from "@/lib/api/portal-client";
import { formatDateTime } from "@/lib/portal-tracking";
import { toast } from "@/lib/toast";
import Link from "next/link";

function todayRangeUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const from = `${y}-${m}-${day}T00:00:00.000Z`;
  const to = `${y}-${m}-${day}T23:59:59.999Z`;
  return { from, to };
}

const TURNOS = [
  { id: "m", label: "Manhã · 07:00–13:00 (UTC)", startH: 7, endH: 13, capacity: 40 },
  { id: "t", label: "Tarde · 13:00–20:00 (UTC)", startH: 13, endH: 20, capacity: 40 },
];

function hourUtc(iso: string) {
  return new Date(iso).getUTCHours();
}

function rowTurnId(row: SolicitacaoRow): string {
  const h = hourUtc(row.createdAt);
  for (const t of TURNOS) {
    if (h >= t.startH && h < t.endH) return t.id;
  }
  return "out";
}

export default function AgendamentosPage() {
  const { from, to } = useMemo(() => todayRangeUtc(), []);
  const [rows, setRows] = useState<SolicitacaoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSolicitacoesPaginated({
        page: 1,
        limit: 100,
        createdFrom: from,
        createdTo: to,
        orderBy: "createdAt",
        order: "desc",
      });
      setRows((res as { items?: SolicitacaoRow[] }).items ?? []);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const byTurn = useMemo(() => {
    const map: Record<string, SolicitacaoRow[]> = { m: [], t: [], out: [] };
    for (const r of rows) {
      map[rowTurnId(r)].push(r);
    }
    return map;
  }, [rows]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SectionTitle
          title="Agendamentos"
          description="Proxy: solicitações criadas hoje (UTC) via GET /cliente/portal/solicitacoes. Dois turnos fixos, capacidade 40 cada."
        />
        <Dialog>
          <DialogTrigger asChild>
            <Button>Novo agendamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo agendamento</DialogTitle>
              <DialogDescription>
                Formulário local — persistência depende de API futura de agendamentos.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <label className="text-xs text-slate-500">ISO</label>
                <Input placeholder="MSCU1234567" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Placa cavalo</label>
                  <Input />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Placa carreta</label>
                  <Input />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">CPF motorista</label>
                <Input />
              </div>
              <div>
                <label className="text-xs text-slate-500">Tipo</label>
                <select className="flex h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
                  <option>Baixa</option>
                  <option>Coleta</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Lacre (se cheio)</label>
                <Input />
              </div>
              <Button
                type="button"
                onClick={() => toast.message("Aguardando API de agendamento no backend.")}
              >
                Enviar (simulado)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {TURNOS.map((t) => {
          const occupied = byTurn[t.id].length;
          const pct = Math.min(100, Math.round((occupied / t.capacity) * 100));
          return (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">{t.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold tabular-nums text-white">
                  {occupied}
                  <span className="text-base font-normal text-slate-500">/{t.capacity}</span>
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">Solicitações criadas no intervalo (proxy operacional).</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {TURNOS.map((t) => (
        <Card key={`list-${t.id}`} className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t.label} — fila do dia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-slate-500">Carregando…</p>
            ) : byTurn[t.id].length === 0 ? (
              <p className="text-slate-500">Nenhuma solicitação neste turno.</p>
            ) : (
              byTurn[t.id].map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-3 last:border-0"
                >
                  <div>
                    <p className="font-mono text-white">{r.protocolo}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/portal/solicitacoes/${r.id}`}>Abrir</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}

      {byTurn.out.length > 0 ? (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base text-amber-100">Fora dos turnos (UTC)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byTurn.out.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-3 last:border-0"
              >
                <div>
                  <p className="font-mono text-white">{r.protocolo}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/portal/solicitacoes/${r.id}`}>Abrir</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
