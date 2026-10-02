"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { OperationCardIdentity } from "@/components/shared/operation-identity";

type TriagemItem = {
  id: string;
  protocolo: string;
  modalidadeTransporte: string;
  statusCarga: string;
  tipoOperacao: string;
  numeroIso: string;
  dataRef: string;
  turno: string;
  clienteNome: string;
  localOrigem: string | null;
  localDestino: string | null;
};

export default function StaffTriagemPage() {
  const [pendentes, setPendentes] = useState<TriagemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reprovandoId, setReprovandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await staffJson<TriagemItem[]>("/v1/agendamentos/triagem/pendentes");
      setPendentes(Array.isArray(rows) ? rows : []);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar triagem";
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  async function handleAprovar(id: string) {
    setSubmitting(id);
    try {
      await staffJson(`/v1/agendamentos/triagem/${id}/aprovar`, { method: "POST" });
      toast.success("Agendamento aprovado — aguardando gate.");
      await refreshList();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao aprovar");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleReprovar(id: string) {
    const m = motivo.trim();
    if (m.length < 3) {
      toast.error("Informe o motivo da reprovação (mín. 3 caracteres).");
      return;
    }
    setSubmitting(id);
    try {
      await staffJson(`/v1/agendamentos/triagem/${id}/reprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: m }),
      });
      toast.success("Agendamento reprovado.");
      setReprovandoId(null);
      setMotivo("");
      await refreshList();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao reprovar");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">Intranet</p>
          <h1 className="text-2xl font-semibold text-white">Triagem de agendamentos</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Aprovação manual quando a autoaprovação não é aplicada. API:{" "}
            <code className="text-emerald-200/90">/v1/agendamentos/triagem</code>
          </p>
        </div>
        <Button type="button" variant="outline" className="border-zinc-600" onClick={() => void refreshList()}>
          Atualizar
        </Button>
      </div>

      <Card className="border-white/10 bg-[#0b101c]/80">
        <CardHeader>
          <CardTitle className="text-lg text-white">Pendentes de triagem</CardTitle>
          <CardDescription className="text-zinc-400">
            {loading ? "Carregando…" : `${pendentes.length} agendamento(s) com status PENDENTE`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {err ? <p className="text-sm text-red-300">{err}</p> : null}
          {!loading && pendentes.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum agendamento aguardando triagem.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400">
                    <th className="px-3 py-2 font-medium">Contêiner</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Ref.</th>
                    <th className="px-3 py-2 font-medium">Modalidade</th>
                    <th className="px-3 py-2 font-medium">Data / Turno</th>
                    <th className="px-3 py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 text-zinc-200">
                      <td className="px-3 py-3">
                        <OperationCardIdentity
                          isos={[item.numeroIso]}
                          size="md"
                          protocolPosition="below"
                        />
                      </td>
                      <td className="px-3 py-3">{item.clienteNome}</td>
                      <td className="px-3 py-3 font-mono text-xs text-zinc-500">{item.protocolo}</td>
                      <td className="px-3 py-3">
                        {item.modalidadeTransporte}
                        <span className="ml-1 text-zinc-500">· {item.statusCarga}</span>
                      </td>
                      <td className="px-3 py-3">
                        {item.dataRef} · {item.turno}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500"
                            disabled={submitting === item.id}
                            onClick={() => void handleAprovar(item.id)}
                          >
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-500/40 text-red-300"
                            disabled={submitting === item.id}
                            onClick={() => {
                              setReprovandoId(item.id);
                              setMotivo("");
                            }}
                          >
                            Reprovar
                          </Button>
                        </div>
                        {reprovandoId === item.id ? (
                          <div className="mt-2 flex max-w-xs flex-col gap-2">
                            <Input
                              value={motivo}
                              onChange={(e) => setMotivo(e.target.value)}
                              placeholder="Motivo da reprovação"
                              className="border-zinc-600 bg-zinc-900"
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-red-600 hover:bg-red-500"
                                disabled={submitting === item.id}
                                onClick={() => void handleReprovar(item.id)}
                              >
                                Confirmar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setReprovandoId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
