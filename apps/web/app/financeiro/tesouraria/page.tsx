"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { defaultRange90d, formatBRL, parseDecimal } from "@/lib/financeiro/format";
import { FinanceStatusBadge } from "@/components/financeiro/finance-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuditRow = {
  id: string;
  tabela: string;
  acao: string;
  usuario: string;
  createdAt: string;
  registroId: string;
};

/** Extrato simulado (somente front) */
const MOCK_EXTRATO = [
  { id: "ext-1", data: "2026-04-28", valor: 12450.33, texto: "PIX RL FAT APR" },
  { id: "ext-2", data: "2026-04-27", valor: 8920.0, texto: "BOLETO COBRANCA" },
  { id: "ext-3", data: "2026-04-26", valor: -3100.5, texto: "TARIFA BANCARIA" },
];

export default function TesourariaPage() {
  const { di, df } = defaultRange90d();
  const pi = di.slice(0, 7);
  const pf = df.slice(0, 7);
  const user = useStaffAuthStore((s) => s.user);
  const ok = user?.role === "ADMIN" || user?.role === "GERENTE";

  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [boletosPagos, setBoletosPagos] = useState(0);
  const [audFat, setAudFat] = useState<AuditRow[]>([]);
  const [audBol, setAudBol] = useState<AuditRow[]>([]);
  const [recoState, setRecoState] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");

  const SALDO_INICIAL = 250_000;

  const load = useCallback(async () => {
    if (!ok) return;
    try {
      const d = await staffJson<Record<string, unknown>>(
        `/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}`,
      );
      setDash(d);

      let paid = 0;
      for (let p = 1; p <= 4; p++) {
        const r = await staffJson<{ items: { id: string }[] }>(`/faturamento?page=${p}&limit=25`);
        if (!r.items?.length) break;
        const det = await Promise.all(r.items.map((i) => staffJson<{ boletos: { statusPagamento: string; valorBoleto: unknown }[] }>(`/faturamento/${i.id}`)));
        for (const f of det) {
          for (const b of f.boletos ?? []) {
            if (b.statusPagamento === "pago") paid += parseDecimal(b.valorBoleto);
          }
        }
        if (r.items.length < 25) break;
      }
      setBoletosPagos(paid);

      const [a1, a2] = await Promise.all([
        staffJson<{ data: AuditRow[]; meta?: { total: number } }>(`/auditoria?tabela=faturamentos&limit=30`),
        staffJson<{ data: AuditRow[] }>(`/auditoria?tabela=boletos&limit=30`),
      ]);
      setAudFat(a1.data ?? []);
      setAudBol(a2.data ?? []);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro tesouraria");
    }
  }, [ok, pi, pf]);

  useEffect(() => {
    void load();
  }, [load]);

  const conciliacao = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return MOCK_EXTRATO.filter((m) => {
      if (!q) return true;
      return m.texto.toLowerCase().includes(q) || String(m.valor).includes(q) || m.data.includes(q);
    }).map((m) => ({
      ...m,
      status: recoState[m.id] ?? "aberto",
    }));
  }, [busca, recoState]);

  const entradas = boletosPagos;
  const saidasProxy = entradas * 0.22;
  const saldoAtual = SALDO_INICIAL + entradas - saidasProxy;

  const forecastProx = Number((dash?.inadimplencia as Record<string, unknown> | undefined)?.forecastFaturamentoProximoMes ?? 0);
  const aging = (dash?.aging as { faixa: string; valorTotal: number }[]) ?? [];
  const pendenteAging = aging.reduce((s, a) => s + Number(a.valorTotal ?? 0), 0);

  if (!ok) return <p className="text-amber-400">Somente gestão.</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Tesouraria · Caixa · Conciliação</h1>
        <p className="text-sm text-zinc-500">Conciliação com extrato mock; saldos combinam dados reais de boletos pagos (amostra).</p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500">Saldo inicial (estático)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-zinc-200">{formatBRL(SALDO_INICIAL)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500">Entradas (boletos PAGO, amostra)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-emerald-400">{formatBRL(entradas)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500">Saídas (proxy 22% entradas)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-400">{formatBRL(saidasProxy)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500">Saldo atual (simulado)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-amber-200">{formatBRL(saldoAtual)}</p>
          </CardContent>
        </Card>

        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-white">Fluxo de caixa projetado</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-zinc-300">
            <div>
              <p className="text-xs text-zinc-500">Próximo mês (faturamento previsto)</p>
              <p className="text-lg font-semibold text-emerald-300">{formatBRL(forecastProx)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Pendências aging (soma faixas)</p>
              <p className="text-lg font-semibold text-amber-300">{formatBRL(pendenteAging)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Risco liquidez</p>
              <p className={`text-lg font-bold ${pendenteAging > saldoAtual * 0.5 ? "text-red-400" : "text-zinc-200"}`}>
                {pendenteAging > saldoAtual * 0.5 ? "Alto" : "Moderado"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-white">Gateway de pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-500">
            <p>Integrações PIX / TED / boleto descontado: placeholders corporativos.</p>
            <Button type="button" variant="outline" className="w-full border-zinc-600" disabled>
              Configurar credenciais (indisponível)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader>
          <CardTitle className="text-white">Conciliação bancária (mock + manual)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            className="max-w-md border-zinc-700 bg-black/40 text-white"
            placeholder="Buscar data, valor ou palavra-chave"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="p-2">Data</th>
                  <th className="p-2">Extrato</th>
                  <th className="p-2">Valor</th>
                  <th className="p-2">Reconhecido</th>
                  <th className="p-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {conciliacao.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-800">
                    <td className="p-2 font-mono text-zinc-400">{row.data}</td>
                    <td className="p-2 text-zinc-300">{row.texto}</td>
                    <td className={`p-2 font-mono ${row.valor < 0 ? "text-red-400" : "text-emerald-300"}`}>
                      {formatBRL(row.valor)}
                    </td>
                    <td className="p-2">
                      {row.status === "reconciliado" ? (
                        <FinanceStatusBadge status="aprovado" />
                      ) : row.valor > 0 ? (
                        <span className="text-xs text-zinc-500">Sugestão: faturamento / boleto</span>
                      ) : (
                        <span className="text-xs text-rose-400">Divergência típica tarifa</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-zinc-600"
                        onClick={() =>
                          setRecoState((s) => ({
                            ...s,
                            [row.id]: s[row.id] === "reconciliado" ? "aberto" : "reconciliado",
                          }))
                        }
                      >
                        {row.status === "reconciliado" ? "Desfazer" : "Conciliar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 lg:col-span-6">
          <CardHeader>
            <CardTitle className="text-white">Auditoria · faturamentos</CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 space-y-2 overflow-y-auto text-xs">
            {audFat.map((r) => (
              <div key={r.id} className="rounded border border-zinc-800 p-2 text-zinc-400">
                <span className="text-zinc-500">{new Date(r.createdAt).toLocaleString("pt-BR")}</span> — {r.acao} — reg{" "}
                <span className="font-mono">{r.registroId.slice(0, 8)}…</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 lg:col-span-6">
          <CardHeader>
            <CardTitle className="text-white">Auditoria · boletos</CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 space-y-2 overflow-y-auto text-xs">
            {audBol.map((r) => (
              <div key={r.id} className="rounded border border-zinc-800 p-2 text-zinc-400">
                <span className="text-zinc-500">{new Date(r.createdAt).toLocaleString("pt-BR")}</span> — {r.acao} — reg{" "}
                <span className="font-mono">{r.registroId.slice(0, 8)}…</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
