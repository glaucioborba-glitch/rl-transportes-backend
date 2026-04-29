"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { formatBRL, parseDecimal } from "@/lib/financeiro/format";
import { patchBoletoStatusJson } from "@/lib/financeiro/boleto-api";
import { AuditTrail } from "@/components/financeiro/audit-trail";
import { FinanceStatusBadge } from "@/components/financeiro/finance-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type FatDetail = {
  id: string;
  periodo: string;
  cliente: { nome: string; id: string };
  boletos: {
    id: string;
    numeroBoleto: string;
    dataVencimento: string;
    valorBoleto: unknown;
    statusPagamento: string;
  }[];
};

function BoletosDetalheInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const boletoId = String(params.id ?? "");
  const fatId = searchParams.get("faturamentoId") ?? "";
  const user = useStaffAuthStore((s) => s.user);
  const ok = user?.role === "ADMIN" || user?.role === "GERENTE";
  const [fat, setFat] = useState<FatDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!fatId || !ok) return;
    try {
      setFat(await staffJson<FatDetail>(`/faturamento/${fatId}`));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro");
    }
  }, [fatId, ok]);

  useEffect(() => {
    void load();
  }, [load]);

  const boleto = fat?.boletos.find((x) => x.id === boletoId);

  async function setStatus(st: "pendente" | "pago" | "vencido" | "cancelado") {
    setBusy(true);
    try {
      await patchBoletoStatusJson(boletoId, st);
      toast.success("Atualizado");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  if (!ok) return <p className="text-amber-400">Restrito.</p>;
  if (!fatId) {
    return (
      <p className="text-zinc-500">
        Informe <code className="text-zinc-400">faturamentoId</code> na URL (retorne pela listagem).
      </p>
    );
  }

  if (!fat || !boleto) return <p className="text-zinc-500">Carregando…</p>;

  return (
    <div className="space-y-6">
      <Link href="/financeiro/areceber" className="text-sm text-amber-500 hover:underline">
        ← AR
      </Link>
      <h1 className="text-xl font-bold text-white">Boleto {boleto.numeroBoleto}</h1>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader>
          <CardTitle className="text-white">Dados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-zinc-300 md:grid-cols-2">
          <div>
            <p className="text-xs text-zinc-500">Linha digitável</p>
            <p className="font-mono text-zinc-400">— (não persistida no modelo atual)</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Vencimento</p>
            <p className="font-mono text-white">{boleto.dataVencimento?.slice(0, 10)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Valor</p>
            <p className="font-mono text-lg text-emerald-300">{formatBRL(parseDecimal(boleto.valorBoleto))}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Status</p>
            <FinanceStatusBadge status={boleto.statusPagamento} />
          </div>
          <div>
            <p className="text-xs text-zinc-500">Cliente</p>
            <p>{fat.cliente.nome}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Fatura (período)</p>
            <p className="font-mono">{fat.periodo}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="min-h-11 bg-emerald-700 hover:bg-emerald-600" disabled={busy} onClick={() => void setStatus("pago")}>
          Marcar PAGO
        </Button>
        <Button type="button" className="min-h-11 bg-red-900/80 hover:bg-red-800" disabled={busy} onClick={() => void setStatus("vencido")}>
          Marcar VENCIDO
        </Button>
        <Button type="button" variant="outline" className="min-h-11 border-zinc-600" disabled={busy} onClick={() => void setStatus("pendente")}>
          Reabrir cobrança (pendente)
        </Button>
        <Button type="button" variant="outline" className="min-h-11 border-zinc-600" disabled={busy} onClick={() => void setStatus("cancelado")}>
          Cancelar
        </Button>
      </div>

      <AuditTrail tabela="boletos" registroId={boletoId} />
    </div>
  );
}

export default function BoletoDetalhePage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Carregando…</p>}>
      <BoletosDetalheInner />
    </Suspense>
  );
}
