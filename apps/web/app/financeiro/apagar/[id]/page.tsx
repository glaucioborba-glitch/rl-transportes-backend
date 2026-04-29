"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { formatBRL, parseDecimal } from "@/lib/financeiro/format";
import { patchBoletoStatusJson, type BoletoStatusPagamento } from "@/lib/financeiro/boleto-api";
import { ApprovalFlow } from "@/components/financeiro/approval-flow";
import { AuditTrail } from "@/components/financeiro/audit-trail";
import { FinanceStatusBadge } from "@/components/financeiro/finance-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type FatDetail = {
  id: string;
  clienteId: string;
  periodo: string;
  valorTotal: unknown;
  statusNfe: string;
  statusBoleto: string;
  createdAt: string;
  cliente: { id: string; nome: string; email?: string };
  itens: { id: string; descricao: string; valor: unknown }[];
  boletos: {
    id: string;
    numeroBoleto: string;
    dataVencimento: string;
    valorBoleto: unknown;
    statusPagamento: string;
  }[];
};

function flowStep(f: FatDetail | null): "criado" | "aprovado" | "pago" {
  if (!f?.boletos?.length) {
    if (f?.statusBoleto === "pago") return "pago";
    return "criado";
  }
  if (f.boletos.every((b) => b.statusPagamento === "pago")) return "pago";
  if (f.boletos.some((b) => b.statusPagamento === "pendente")) return "aprovado";
  return "criado";
}

export default function ApagarDetalhePage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const user = useStaffAuthStore((s) => s.user);
  const ok = user?.role === "ADMIN" || user?.role === "GERENTE";
  const [fat, setFat] = useState<FatDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !ok) return;
    try {
      setFat(await staffJson<FatDetail>(`/faturamento/${id}`));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar");
    }
  }, [id, ok]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchBoleto(bid: string, st: BoletoStatusPagamento) {
    setBusy(bid);
    try {
      await patchBoletoStatusJson(bid, st);
      toast.success("Status atualizado");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha no PATCH");
    } finally {
      setBusy(null);
    }
  }

  if (!ok) return <p className="text-amber-400">Acesso restrito.</p>;

  if (!fat) return <p className="text-zinc-500">Carregando…</p>;

  const step = flowStep(fat);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/financeiro/apagar" className="text-sm text-amber-500 hover:underline">
          ← Voltar
        </Link>
        <h1 className="text-xl font-bold text-white">Lançamento {fat.periodo}</h1>
        <FinanceStatusBadge status={fat.statusBoleto} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/60 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-white">Credor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-zinc-300">
            <p className="text-lg font-semibold text-white">{fat.cliente.nome}</p>
            <p className="text-xs font-mono text-zinc-500">{fat.clienteId}</p>
            <p className="mt-4 text-sm">Valor total: {formatBRL(parseDecimal(fat.valorTotal))}</p>
            <p className="text-sm">NFS-e: {fat.statusNfe}</p>
          </CardContent>
        </Card>

        <div className="col-span-12 space-y-4 lg:col-span-8">
          <ApprovalFlow current={step} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11 bg-sky-600 hover:bg-sky-500"
              disabled={!!busy}
              onClick={() => toast("Fluxo interno: aprovação registrada para governança (sem campo extra no backend).")}
            >
              Aprovar pagamento
            </Button>
            <Button
              type="button"
              className="min-h-11 bg-emerald-600 hover:bg-emerald-500"
              disabled={!!busy || !fat.boletos?.length}
              onClick={() => {
                void Promise.all(
                  fat.boletos.filter((b) => b.statusPagamento !== "pago").map((b) => patchBoleto(b.id, "pago")),
                );
              }}
            >
              Registrar pagamento (todos em aberto → PAGO)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-zinc-600"
              disabled={!!busy || !fat.boletos?.length}
              onClick={() => {
                void Promise.all(
                  fat.boletos.filter((b) => b.statusPagamento !== "pendente").map((b) => patchBoleto(b.id, "pendente")),
                );
              }}
            >
              Enviar para revisão (→ pendente)
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/60">
        <CardHeader>
          <CardTitle className="text-white">Histórico da despesa (itens)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-zinc-800">
            {fat.itens.map((it) => (
              <li key={it.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span className="text-zinc-300">{it.descricao}</span>
                <span className="font-mono text-zinc-100">{formatBRL(parseDecimal(it.valor))}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/60">
        <CardHeader>
          <CardTitle className="text-white">Boletos vinculados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!fat.boletos.length ? <p className="text-zinc-500">Sem boletos.</p> : null}
          {fat.boletos.map((b) => (
            <div
              key={b.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-black/30 p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-mono text-sm text-white">{b.numeroBoleto}</p>
                <p className="text-xs text-zinc-500">Venc. {b.dataVencimento?.slice(0, 10)}</p>
                <p className="font-mono text-amber-200/90">{formatBRL(parseDecimal(b.valorBoleto))}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <FinanceStatusBadge status={b.statusPagamento} />
                <Button
                  size="sm"
                  className="min-h-9 bg-emerald-700"
                  disabled={busy === b.id}
                  onClick={() => void patchBoleto(b.id, "pago")}
                >
                  Pago
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-9 border-zinc-600"
                  disabled={busy === b.id}
                  onClick={() => void patchBoleto(b.id, "vencido")}
                >
                  Vencido
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-9 border-zinc-600"
                  disabled={busy === b.id}
                  onClick={() => void patchBoleto(b.id, "pendente")}
                >
                  Pendente
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <AuditTrail tabela="faturamentos" registroId={fat.id} />
          <p className="mt-2 text-xs text-zinc-500">
            Boletos: histórico em <code className="text-zinc-400">GET /auditoria/registro/boletos/&lt;id&gt;</code>{" "}
            (mesmo padrão do cabeçalho de faturamento).
          </p>
        </div>
      </div>
    </div>
  );
}
