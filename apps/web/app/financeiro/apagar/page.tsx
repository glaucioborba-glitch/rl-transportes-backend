"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { defaultRange90d, formatBRL, parseDecimal } from "@/lib/financeiro/format";
import { FinanceStatusBadge } from "@/components/financeiro/finance-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type ApRow = {
  id: string;
  fatId: string;
  credor: string;
  clienteId: string;
  categoria: "faturamento" | "boleto" | "servicos";
  valor: number;
  vencimento: string;
  status: string;
  metodo: string;
  responsavel: string;
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function SparkLine({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-zinc-600">—</span>;
  const m = Math.max(...values, 1);
  return (
    <div className="flex h-14 items-end gap-px">
      {values.map((v, i) => (
        <div key={i} className="w-1 flex-1 rounded-t bg-amber-500/70" style={{ height: `${(v / m) * 100}%` }} />
      ))}
    </div>
  );
}

export default function ApagarPage() {
  const { di, df } = defaultRange90d();
  const user = useStaffAuthStore((s) => s.user);
  const ok = user?.role === "ADMIN" || user?.role === "GERENTE";

  const [dataInicio, setDataInicio] = useState(di);
  const [dataFim, setDataFim] = useState(df);
  const [clienteId, setClienteId] = useState("");
  const [statusFil, setStatusFil] = useState("");
  const [catFil, setCatFil] = useState("");
  const [sort, setSort] = useState<"valor" | "vencimento" | "status">("vencimento");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ApRow[]>([]);
  const [dashFin, setDashFin] = useState<Record<string, unknown> | null>(null);
  const [relResumo, setRelResumo] = useState<Record<string, unknown> | null>(null);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);

  const load = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const pi = dataInicio.slice(0, 7);
      const pf = dataFim.slice(0, 7);
      const [lista, dash, resumo, cl] = await Promise.all([
        staffJson<{ items: { id: string }[] }>(
          `/relatorios/financeiro/faturamento/lista?dataInicio=${dataInicio}&dataFim=${dataFim}&page=1&limit=40${
            clienteId ? `&clienteId=${encodeURIComponent(clienteId)}` : ""
          }`,
        ),
        staffJson<Record<string, unknown>>(
          `/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}${
            clienteId ? `&clienteId=${encodeURIComponent(clienteId)}` : ""
          }`,
        ).catch(() => null),
        staffJson<Record<string, unknown>>(
          `/relatorios/financeiro/faturamento?dataInicio=${dataInicio}&dataFim=${dataFim}${
            clienteId ? `&clienteId=${encodeURIComponent(clienteId)}` : ""
          }`,
        ).catch(() => null),
        staffJson<{ data: { id: string; nome: string }[] }>(`/clientes?limit=200&page=1`).catch(() => ({
          data: [],
        })),
      ]);

      setDashFin(dash);
      setRelResumo(resumo);
      setClientes(cl.data ?? []);

      const details: FatDetail[] = await Promise.all(
        (lista.items ?? []).map((it) => staffJson<FatDetail>(`/faturamento/${it.id}`)),
      );

      const out: ApRow[] = [];
      for (const f of details) {
        const base = `Faturamento ${f.periodo}`;
        if (f.boletos?.length) {
          for (const b of f.boletos) {
            out.push({
              id: b.id,
              fatId: f.id,
              credor: f.cliente.nome,
              clienteId: f.clienteId,
              categoria: "boleto",
              valor: parseDecimal(b.valorBoleto),
              vencimento: b.dataVencimento?.slice(0, 10) ?? "",
              status: b.statusPagamento,
              metodo: "Boleto",
              responsavel: base,
            });
          }
        } else {
          out.push({
            id: f.id,
            fatId: f.id,
            credor: f.cliente.nome,
            clienteId: f.clienteId,
            categoria: "faturamento",
            valor: parseDecimal(f.valorTotal),
            vencimento: `${f.periodo}-28`,
            status: f.statusBoleto,
            metodo: "Faturamento (consolidado)",
            responsavel: "—",
          });
        }
      }

      setRows(out);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar AP");
    } finally {
      setLoading(false);
    }
  }, [ok, dataInicio, dataFim, clienteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFil) r = r.filter((x) => x.status.toLowerCase() === statusFil.toLowerCase());
    if (catFil) r = r.filter((x) => x.categoria === catFil);
    const copy = [...r];
    copy.sort((a, b) => {
      if (sort === "valor") return b.valor - a.valor;
      if (sort === "status") return a.status.localeCompare(b.status);
      return a.vencimento.localeCompare(b.vencimento);
    });
    return copy;
  }, [rows, statusFil, catFil, sort]);

  const kpis = useMemo(() => {
    const t = todayISODate();
    const aPagarHoje = filtered.filter((r) => r.vencimento === t && r.status === "pendente").reduce((s, r) => s + r.valor, 0);
    const vencido = filtered.filter((r) => r.status === "vencido").reduce((s, r) => s + r.valor, 0);
    const alvo7 = new Date();
    alvo7.setDate(alvo7.getDate() + 7);
    const alvo30 = new Date();
    alvo30.setDate(alvo30.getDate() + 30);
    const proj7 = filtered
      .filter((r) => {
        const d = new Date(r.vencimento);
        return r.status === "pendente" && d >= new Date(t) && d <= alvo7;
      })
      .reduce((s, r) => s + r.valor, 0);
    const proj30 = filtered
      .filter((r) => {
        const d = new Date(r.vencimento);
        return r.status === "pendente" && d >= new Date(t) && d <= alvo30;
      })
      .reduce((s, rn) => s + rn.valor, 0);
    const series = (dashFin?.series as { mes?: string; pendente?: number; vencido?: number }[]) ?? [];
    const curve = series.map((s) => Number(s.pendente ?? 0) + Number(s.vencido ?? 0));
    const snap = dashFin?.snapshot as Record<string, unknown> | undefined;
    const donut = snap?.faturamentoConcluidoVsPendente as { pendente?: number } | undefined;

    const topCred = (dashFin?.receita as { faturamentoPorClienteTop10?: { clienteNome: string; valorTotal: number }[] })
      ?.faturamentoPorClienteTop10 ?? [];

    const risco =
      vencido > 0 && parseDecimal(relResumo?.totalValor) > 0
        ? vencido / parseDecimal(relResumo?.totalValor)
        : 0;

    return { aPagarHoje, vencido, proj7, proj30, curve, donutPendente: donut?.pendente ?? 0, topCred, risco };
  }, [filtered, dashFin, relResumo]);

  if (!ok) {
    return <p className="text-center text-amber-400">Acesso apenas para ADMIN ou GERENTE.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Contas a pagar · Tesouraria</h1>
        <p className="text-sm text-zinc-500">
          Dados: relatórios financeiros, faturamento, boletos e dashboard executivo. Alteração de status: PATCH{" "}
          <code className="text-zinc-400">/faturamento/boletos/:id</code>.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/60 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">A pagar hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", kpis.aPagarHoje > 0 ? "text-red-400" : "text-emerald-400")}>
              {formatBRL(kpis.aPagarHoje)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/60 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total vencido (amostra)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{formatBRL(kpis.vencido)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/60 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Projeção 7 / 30 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-amber-200">{formatBRL(kpis.proj7)}</p>
            <p className="text-sm text-zinc-500">30d: {formatBRL(kpis.proj30)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/60 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Risco caixa (vencido / faturado)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", kpis.risco > 0.15 ? "text-red-400" : kpis.risco > 0.08 ? "text-amber-400" : "text-emerald-400")}>
              {(kpis.risco * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-12 border-zinc-800 bg-zinc-900/60 lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-white">Curva de desembolso (pendente + vencido por competência)</CardTitle>
          </CardHeader>
          <CardContent>
            <SparkLine values={kpis.curve.length ? kpis.curve : [0]} />
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/60 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-white">Maiores credores (receita período)</CardTitle>
          </CardHeader>
          <CardContent className="max-h-48 space-y-2 overflow-y-auto text-sm">
            {kpis.topCred.length ? (
              kpis.topCred.slice(0, 8).map((c) => (
                <div key={c.clienteNome} className="flex justify-between gap-2 border-b border-white/5 py-1">
                  <span className="truncate text-zinc-300">{c.clienteNome}</span>
                  <span className="shrink-0 font-mono text-zinc-400">{formatBRL(Number(c.valorTotal ?? 0))}</span>
                </div>
              ))
            ) : (
              <p className="text-zinc-500">Sem ranking no período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/60">
        <CardHeader>
          <CardTitle className="text-white">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-12 gap-3">
          <div className="col-span-12 flex flex-wrap gap-2 md:col-span-4">
            <input
              type="date"
              className="h-11 rounded-lg border border-zinc-700 bg-black/40 px-3 text-white"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <input
              type="date"
              className="h-11 rounded-lg border border-zinc-700 bg-black/40 px-3 text-white"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <select
            className="col-span-12 h-11 rounded-lg border border-zinc-700 bg-black/40 px-3 text-white md:col-span-4"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Todos clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <select
            className="col-span-12 h-11 rounded-lg border border-zinc-700 bg-black/40 px-3 text-white md:col-span-2"
            value={statusFil}
            onChange={(e) => setStatusFil(e.target.value)}
          >
            <option value="">Status pagamento</option>
            <option value="pendente">pendente</option>
            <option value="pago">pago</option>
            <option value="vencido">vencido</option>
            <option value="cancelado">cancelado</option>
          </select>
          <select
            className="col-span-12 h-11 rounded-lg border border-zinc-700 bg-black/40 px-3 text-white md:col-span-2"
            value={catFil}
            onChange={(e) => setCatFil(e.target.value)}
          >
            <option value="">Categoria</option>
            <option value="faturamento">faturamento</option>
            <option value="boleto">boleto</option>
            <option value="servicos">servicos</option>
          </select>
          <div className="col-span-12 flex flex-wrap gap-2">
            <span className="text-xs text-zinc-500">Ordenar:</span>
            {(["vencimento", "valor", "status"] as const).map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={sort === k ? "default" : "outline"}
                className={cn(sort === k ? "bg-amber-600" : "border-zinc-600", "min-h-10")}
                onClick={() => setSort(k)}
              >
                {k}
              </Button>
            ))}
            <Button type="button" variant="outline" className="min-h-10 border-zinc-600" onClick={() => void load()} disabled={loading}>
              Recarregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-black/40 text-xs uppercase text-zinc-500">
            <tr>
              <th className="p-3">Credor</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Vencimento</th>
              <th className="p-3">Status</th>
              <th className="p-3">Método</th>
              <th className="p-3">Ref.</th>
              <th className="p-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800/80 hover:bg-white/5">
                <td className="p-3 text-zinc-200">{r.credor}</td>
                <td className="p-3 capitalize text-zinc-400">{r.categoria}</td>
                <td className="p-3 font-mono text-zinc-100">{formatBRL(r.valor)}</td>
                <td className="p-3 font-mono text-zinc-400">{r.vencimento}</td>
                <td className="p-3">
                  <FinanceStatusBadge status={r.status} />
                </td>
                <td className="p-3 text-zinc-500">{r.metodo}</td>
                <td className="max-w-[180px] truncate p-3 text-xs text-zinc-500">{r.responsavel}</td>
                <td className="p-3">
                  <Link
                    href={`/financeiro/apagar/${r.fatId}`}
                    className="inline-flex min-h-10 items-center rounded-lg bg-amber-600/90 px-4 text-sm font-semibold text-black hover:bg-amber-500"
                  >
                    Detalhe
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="p-4 text-zinc-500">Carregando…</p> : null}
        {!loading && !filtered.length ? <p className="p-4 text-zinc-500">Nenhuma linha no filtro.</p> : null}
      </div>
    </div>
  );
}
