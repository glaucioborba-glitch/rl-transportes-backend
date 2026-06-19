"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, staffListarSolicitacoesV2, staffSolicitacoesV2Metricas } from "@/lib/api/staff-client";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { OperationCardIdentity } from "@/components/shared/operation-identity";
import { toast } from "@/lib/toast";

export default function StaffSolicitacoesV2ListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ items: Record<string, unknown>[]; total: number } | null>(null);

  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof staffSolicitacoesV2Metricas>> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([staffListarSolicitacoesV2({ page, limit: 20, status: status || undefined }), staffSolicitacoesV2Metricas()]);
      setData({ items: r.items as Record<string, unknown>[], total: r.total });
      setMetrics(m);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao listar");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/90">Operações</p>
        <h1 className="text-2xl font-semibold text-white">Solicitações corporativas (v2)</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Fluxo LS/Rodotrem com transporte, containers, anexos e aprovação staff. API:{" "}
          <code className="text-violet-200/90">GET /v2/solicitacoes</code>.
        </p>
      </div>

      {metrics ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-white/10 bg-[#0b101c]/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-white">{metrics.totalSolicitacoesV2}</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0b101c]/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">LS / Rodotrem</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-300">
              <p>LS: {metrics.porTipoCaminhao.LS}</p>
              <p>Rodotrem: {metrics.porTipoCaminhao.RODOTREM}</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0b101c]/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Containers</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-300">
              <p>Cheio: {metrics.containers.cheio}</p>
              <p>Vazio: {metrics.containers.vazio}</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0b101c]/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Reefer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-emerald-200/90">{metrics.containers.refrigerados}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="border-white/10 bg-[#0b101c]/80">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-lg text-white">Filtros</CardTitle>
            <CardDescription className="text-zinc-500">Somente solicitações com transporte v2 persistido.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 rounded-md border border-zinc-600 bg-black/40 px-3 text-sm text-white"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os status</option>
              <option value="PENDENTE">PENDENTE</option>
              <option value="EM_ANALISE">EM_ANALISE</option>
              <option value="AGUARDANDO_GATE_IN">AGUARDANDO_GATE_IN</option>
              <option value="EM_PATIO">EM_PATIO</option>
              <option value="AGUARDANDO_GATE_OUT">AGUARDANDO_GATE_OUT</option>
              <option value="CONCLUIDO">CONCLUIDO</option>
              <option value="APROVADO">APROVADO</option>
              <option value="REJEITADO">REJEITADO</option>
            </select>
            <Button type="button" variant="outline" className="border-zinc-600" onClick={() => void load()} disabled={loading}>
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/5">
              <table className="w-full min-w-[640px] text-left text-sm text-zinc-200">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Contêiner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Caminhão</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((row) => {
                    const tr = row.transporteSolicitacao as Record<string, unknown> | undefined;
                    const cl = row.cliente as Record<string, unknown> | undefined;
                    const containers = row.containersSolicitacao as
                      | Array<{ unidade?: string; ordem?: number }>
                      | undefined;
                    return (
                      <tr key={String(row.id)} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <OperationCardIdentity
                            isos={collectSolicitacaoContainerISOs({ containersSolicitacao: containers })}
                            protocolo={String(row.protocolo ?? "")}
                            size="md"
                          />
                        </td>
                        <td className="px-4 py-3">{String(row.status ?? "")}</td>
                        <td className="px-4 py-3">
                          {tr ? (
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                                String(tr.tipoCaminhao) === "LS"
                                  ? "bg-sky-600/30 text-sky-100"
                                  : "bg-amber-600/30 text-amber-100"
                              }`}
                            >
                              {String(tr.tipoCaminhao ?? "—")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">{cl ? String(cl.razaoSocial ?? cl.nomeFantasia ?? "—") : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            className="text-violet-300 underline-offset-2 hover:underline"
                            href={`/staff/solicitacoes-v2/${String(row.id)}`}
                          >
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              Pág. {page} / {totalPages} · {data?.total ?? 0} registro(s)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-zinc-600" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-600"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
