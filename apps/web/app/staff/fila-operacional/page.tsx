"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { OperationCardIdentity } from "@/components/shared/operation-identity";

type FilaItem = {
  agendamentoId: string;
  numeroIso: string;
  statusAgendamento: string;
  solicitacaoId: string | null;
  statusSolicitacao: string | null;
  protocolo: string | null;
  clienteId: string;
  clienteNome: string;
};

type FilaResp = {
  dataRef: string;
  turno: string;
  geradoEm: string;
  total: number;
  itens: FilaItem[];
};

export default function StaffFilaOperacionalPage() {
  const [data, setData] = useState<FilaResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await staffJson<FilaResp>("/v1/agendamentos/fila");
      setData(r);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar fila";
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">Operações</p>
          <h1 className="text-2xl font-semibold text-white">Fila do dia (turno)</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Backlog integrado ao ecossistema RL: capacidade AM/PM, agendamentos persistidos e status da
            solicitação. Dados via <code className="text-emerald-200/90">GET /v1/agendamentos/fila</code>.
          </p>
        </div>
        <Button type="button" variant="outline" className="border-zinc-600" onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      <Card className="border-white/10 bg-[#0b101c]/80">
        <CardHeader>
          <CardTitle className="text-lg text-white">Agendamentos no turno atual</CardTitle>
          <CardDescription className="text-zinc-400">
            {loading
              ? "Carregando…"
              : data
                ? `${data.dataRef} · ${data.turno} · ${data.total} slot(s)`
                : err ?? "—"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {err && !loading ? (
            <p className="text-sm text-rose-300">{err}</p>
          ) : null}
          {!data?.itens.length && !loading && !err ? (
            <p className="text-sm text-zinc-400">Nenhum agendamento pendente para este turno.</p>
          ) : null}
          {data && data.itens.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-white/5">
              <table className="w-full min-w-[720px] text-left text-sm text-zinc-200">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">ISO</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Agendamento</th>
                    <th className="px-4 py-3">Ref.</th>
                    <th className="px-4 py-3">Status OS</th>
                    <th className="px-4 py-3 w-28">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.itens.map((row: FilaItem) => (
                    <tr key={row.agendamentoId} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <OperationCardIdentity isos={[row.numeroIso]} size="md" />
                      </td>
                      <td className="px-4 py-3">{row.clienteNome}</td>
                      <td className="px-4 py-3">{row.statusAgendamento}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">{row.protocolo ?? "—"}</td>
                      <td className="px-4 py-3">{row.statusSolicitacao ?? "—"}</td>
                      <td className="px-4 py-3">
                        {row.solicitacaoId ? (
                          <Link
                            className="text-violet-300 underline-offset-2 hover:underline"
                            href={`/staff/solicitacoes-v2/${row.solicitacaoId}`}
                          >
                            Detalhe v2
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
