"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, staffGateFila, type StaffGateFilaItem } from "@/lib/api/staff-client";
import { OperationCardIdentity } from "@/components/shared/operation-identity";
import { toast } from "@/lib/toast";

function statusTone(label: string, statusDb: string) {
  if (statusDb === "AGUARDANDO_GATE_IN" || statusDb === "APROVADO") return "bg-amber-500/25 text-amber-100 border-amber-500/40";
  if (statusDb === "EM_PATIO") return "bg-sky-500/25 text-sky-100 border-sky-500/40";
  if (statusDb === "AGUARDANDO_GATE_OUT") return "bg-violet-500/25 text-violet-100 border-violet-500/40";
  return "bg-zinc-600/30 text-zinc-200 border-zinc-500/30";
}

export default function StaffGateFilaPage() {
  const [rows, setRows] = useState<StaffGateFilaItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await staffGateFila());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar fila");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/90">Operação</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Gate v2 — Check-in / Check-out</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Fila unificada às solicitações corporativas (autenticidade + divergências + fotos).
          </p>
        </div>
        <Button type="button" variant="outline" className="border-zinc-600" onClick={() => void load()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      <Card className="border-white/10 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="text-lg text-white">Fila operacional</CardTitle>
          <CardDescription className="text-zinc-500">
            Protocolo, cliente, tipo LS/Rodotrem e estágio do gate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !rows ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/5">
              <table className="w-full min-w-[720px] text-left text-sm text-zinc-200">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Contêiner</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status gate</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <OperationCardIdentity
                          isos={r.containersIso ?? []}
                          protocolo={r.protocolo}
                          size="md"
                        />
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{r.cliente.razaoSocial}</td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral" className="border-zinc-500 text-zinc-200">
                          {r.tipoCaminhao}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusTone(r.gateLabel, r.statusDb)}`}
                        >
                          {r.gateLabel}
                        </span>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">DB: {r.statusDb}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {(r.statusDb === "AGUARDANDO_GATE_IN" || r.statusDb === "APROVADO") && (
                            <Button size="sm" className="bg-emerald-700 text-white hover:bg-emerald-600" asChild>
                              <Link href={`/staff/gate/checkin/${r.id}`}>Check-in</Link>
                            </Button>
                          )}
                          {(r.statusDb === "EM_PATIO" || r.statusDb === "AGUARDANDO_GATE_OUT") && r.gateInAbertoId ? (
                            <Button size="sm" className="bg-sky-700 text-white hover:bg-sky-600" asChild>
                              <Link href={`/staff/gate/checkout/${r.gateInAbertoId}`}>Check-out</Link>
                            </Button>
                          ) : null}
                          {r.statusDb === "EM_PATIO" && r.gateInAbertoId ? (
                            <Button size="sm" variant="outline" className="border-emerald-600/50 text-emerald-100" asChild>
                              <Link href={`/staff/patio?gateIn=${r.gateInAbertoId}`}>Pátio</Link>
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" className="border-zinc-600" asChild>
                            <Link href={`/staff/solicitacoes-v2/${r.id}`}>Detalhe v2</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && (rows?.length ?? 0) === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">Nenhum registro na fila com os filtros atuais.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
