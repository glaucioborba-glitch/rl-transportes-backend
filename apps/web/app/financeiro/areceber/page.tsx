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

type DashFin = {
  snapshot?: Record<string, unknown>;
  inadimplencia?: Record<string, unknown>;
  aging?: { faixa: string; valorTotal: number; quantidadeBoletos: number }[];
  series?: { mes: string; pendente: number; vencido: number; faturado: number; recebido: number }[];
  clientes?: { curvaAbc: { clienteNome: string; valor: number; classe: string }[] };
  receita?: { mediaTicketPorSolicitacao?: number | null };
};

type FatDetail = {
  id: string;
  periodo: string;
  cliente: { nome: string };
  boletos: {
    id: string;
    numeroBoleto: string;
    dataVencimento: string;
    valorBoleto: unknown;
    statusPagamento: string;
  }[];
};

type BoletoRow = {
  boletoId: string;
  numeroBoleto: string;
  cliente: string;
  vencimento: string;
  status: string;
  valor: number;
  faturaId: string;
  periodo: string;
};

const COB_STORAGE = "rl_fin_cobranca_contatos";

type CobLog = { t: string; clienteId: string; nota: string };

export default function AreceberPage() {
  const { di, df } = defaultRange90d();
  const user = useStaffAuthStore((s) => s.user);
  const ok = user?.role === "ADMIN" || user?.role === "GERENTE";
  const pi = di.slice(0, 7);
  const pf = df.slice(0, 7);

  const [dash, setDash] = useState<DashFin | null>(null);
  const [boletos, setBoletos] = useState<BoletoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [cobNota, setCobNota] = useState("");
  const [cobLog, setCobLog] = useState<CobLog[]>([]);

  const load = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const d = await staffJson<DashFin>(`/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}`);
      setDash(d);

      const rows: BoletoRow[] = [];
      for (let page = 1; page <= 8; page++) {
        const r = await staffJson<{ items: { id: string }[] }>(`/faturamento?page=${page}&limit=25`);
        if (!r.items?.length) break;
        const det = await Promise.all(r.items.map((i) => staffJson<FatDetail>(`/faturamento/${i.id}`)));
        for (const f of det) {
          for (const b of f.boletos ?? []) {
            rows.push({
              boletoId: b.id,
              numeroBoleto: b.numeroBoleto,
              cliente: f.cliente.nome,
              vencimento: b.dataVencimento?.slice(0, 10) ?? "",
              status: b.statusPagamento,
              valor: parseDecimal(b.valorBoleto),
              faturaId: f.id,
              periodo: f.periodo,
            });
          }
        }
        if (r.items.length < 25) break;
      }
      setBoletos(rows);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro AR");
    } finally {
      setLoading(false);
    }
  }, [ok, pi, pf]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COB_STORAGE);
      setCobLog(raw ? (JSON.parse(raw) as CobLog[]) : []);
    } catch {
      setCobLog([]);
    }
  }, []);

  function registrarCobranca() {
    const rank = (dash?.inadimplencia?.inadimplenciaPorCliente as { clienteId: string }[] | undefined) ?? [];
    const cid = rank[0]?.clienteId ?? "";
    const entry: CobLog = { t: new Date().toISOString(), clienteId: cid, nota: cobNota || "(sem texto)" };
    const next = [entry, ...cobLog].slice(0, 50);
    setCobLog(next);
    localStorage.setItem(COB_STORAGE, JSON.stringify(next));
    setCobNota("");
    toast.success("Contato registrado (somente neste navegador)");
  }

  const filtrados = useMemo(() => {
    let r = boletos;
    if (filtroCliente.trim()) {
      const q = filtroCliente.toLowerCase();
      r = r.filter((x) => x.cliente.toLowerCase().includes(q));
    }
    if (filtroStatus === "aberto") r = r.filter((x) => x.status === "pendente");
    if (filtroStatus === "vencido") r = r.filter((x) => x.status === "vencido");
    if (filtroStatus === "pago") r = r.filter((x) => x.status === "pago");
    return r;
  }, [boletos, filtroCliente, filtroStatus]);

  const kpis = useMemo(() => {
    const i = dash?.inadimplencia ?? {};
    const aberto = filtrados.filter((x) => x.status === "pendente" || x.status === "vencido").reduce((s, x) => s + x.valor, 0);
    const vencido = Number(i.valorVencidoTotal ?? 0) || filtrados.filter((x) => x.status === "vencido").reduce((s, x) => s + x.valor, 0);
    const taxa = i.taxaInadimplenciaGeralPercent;
    const ticket = dash?.receita?.mediaTicketPorSolicitacao ?? null;
    return { aberto, vencido, taxa, ticket };
  }, [dash, filtrados]);

  const ranking = (dash?.inadimplencia?.inadimplenciaPorCliente ?? []) as {
    clienteNome: string;
    valorVencido: number;
    quantidadeBoletosVencidos: number;
  }[];

  if (!ok) return <p className="text-amber-400">Somente gestão.</p>;

  const aging = dash?.aging ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Contas a receber · Cobrança</h1>
          <p className="text-sm text-zinc-500">Dashboard: período {pi} — {pf}. Boletos: amostra via GET /faturamento.</p>
        </div>
        <Button type="button" variant="outline" className="min-h-11 border-zinc-600" onClick={() => void load()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 md:col-span-6 xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-zinc-500">Valor em aberto (amostra)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-200">{formatBRL(kpis.aberto)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 md:col-span-6 xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-zinc-500">Valor vencido (proxy dashboard)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{formatBRL(kpis.vencido)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 md:col-span-6 xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-zinc-500">% inadimplência geral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-300">
              {kpis.taxa != null ? `${Number(kpis.taxa).toFixed(2)}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 md:col-span-6 xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-zinc-500">Ticket médio (solicitação)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-zinc-200">
              {kpis.ticket != null ? formatBRL(Number(kpis.ticket)) : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 xl:col-span-6">
          <CardHeader>
            <CardTitle className="text-white">Aging (backend)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="p-2">Faixa</th>
                  <th className="p-2">Valor</th>
                  <th className="p-2">Qtd boletos</th>
                </tr>
              </thead>
              <tbody>
                {aging.map((a) => (
                  <tr key={a.faixa} className="border-t border-zinc-800">
                    <td className="p-2 text-zinc-300">{a.faixa}</td>
                    <td className="p-2 font-mono">{formatBRL(Number(a.valorTotal ?? 0))}</td>
                    <td className="p-2">{a.quantidadeBoletos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 xl:col-span-6">
          <CardHeader>
            <CardTitle className="text-white">Heatmap inadimplência (série: vencido por mês)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="flex min-h-[120px] items-end gap-1">
              {(dash?.series ?? []).map((s) => {
                const max = Math.max(...(dash?.series ?? []).map((x) => x.vencido + x.pendente), 1);
                const h = ((s.vencido + s.pendente) / max) * 100;
                return (
                  <div key={s.mes} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-red-900/80 to-amber-600/60"
                      style={{ height: `${Math.max(8, h)}%` }}
                      title={`${s.mes} pendente ${s.pendente} vencido ${s.vencido}`}
                    />
                    <span className="text-[10px] text-zinc-500">{s.mes.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 lg:col-span-6">
          <CardHeader>
            <CardTitle className="text-white">Forecast</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
            <div>
              <p className="text-xs text-zinc-500">Faturamento próximo mês</p>
              <p className="text-lg font-semibold text-emerald-300">
                {formatBRL(Number(dash?.inadimplencia?.forecastFaturamentoProximoMes ?? 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Inadimplência prevista %</p>
              <p className="text-lg font-semibold text-rose-300">
                {dash?.inadimplencia?.forecastInadimplenciaPercent != null
                  ? `${Number(dash.inadimplencia.forecastInadimplenciaPercent).toFixed(2)}%`
                  : "—"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs text-zinc-500">Curva ABC receita</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {(dash?.clientes?.curvaAbc ?? []).slice(0, 12).map((c) => (
                  <li key={c.clienteNome} className="flex justify-between gap-2 border-b border-white/5 py-1">
                    <span className="truncate">
                      <span className="mr-2 text-amber-500">{c.classe}</span>
                      {c.clienteNome}
                    </span>
                    <span className="shrink-0 font-mono text-zinc-400">{formatBRL(Number(c.valor ?? 0))}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 border-zinc-800 bg-zinc-900/70 lg:col-span-6">
          <CardHeader>
            <CardTitle className="text-white">Cobrança ativa (timeline local)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-zinc-500">Clientes críticos (backend):</p>
            <ul className="text-sm text-zinc-300">
              {ranking.slice(0, 5).map((r) => (
                <li key={r.clienteNome} className="flex justify-between gap-2 py-1">
                  <span>{r.clienteNome}</span>
                  <span className="font-mono text-red-300">{formatBRL(Number(r.valorVencido ?? 0))}</span>
                </li>
              ))}
            </ul>
            <textarea
              className="min-h-[72px] w-full rounded-lg border border-zinc-700 bg-black/40 p-3 text-sm text-white"
              placeholder="Nota do contato de cobrança"
              value={cobNota}
              onChange={(e) => setCobNota(e.target.value)}
            />
            <Button type="button" className="min-h-11 bg-amber-600 text-black hover:bg-amber-500" onClick={registrarCobranca}>
              Registrar contato de cobrança
            </Button>
            <ul className="max-h-40 space-y-2 overflow-y-auto text-xs text-zinc-400">
              {cobLog.map((c, i) => (
                <li key={i}>
                  {new Date(c.t).toLocaleString("pt-BR")} — {c.nota}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader>
          <CardTitle className="text-white">Boletos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              className="h-11 min-w-[200px] flex-1 rounded-lg border border-zinc-700 bg-black/40 px-3 text-white"
              placeholder="Filtrar cliente"
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
            />
            <select
              className="h-11 rounded-lg border border-zinc-700 bg-black/40 px-3 text-white"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="">Todos status</option>
              <option value="aberto">Aberto (pendente)</option>
              <option value="vencido">Vencido</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="p-2">Número</th>
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Vencimento</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Valor</th>
                  <th className="p-2">Fatura</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.boletoId} className="border-b border-zinc-800/80 hover:bg-white/5">
                    <td className="p-2 font-mono text-zinc-200">{r.numeroBoleto}</td>
                    <td className="p-2 text-zinc-300">{r.cliente}</td>
                    <td className="p-2 font-mono text-zinc-400">{r.vencimento}</td>
                    <td className="p-2">
                      <FinanceStatusBadge status={r.status} />
                    </td>
                    <td className="p-2 font-mono">{formatBRL(r.valor)}</td>
                    <td className="p-2 font-mono text-xs text-zinc-500">{r.periodo}</td>
                    <td className="p-2">
                      <Link
                        href={`/financeiro/areceber/boletos/${r.boletoId}?faturamentoId=${encodeURIComponent(r.faturaId)}`}
                        className="inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 hover:bg-white"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading ? <p className="p-4 text-zinc-500">Carregando…</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
