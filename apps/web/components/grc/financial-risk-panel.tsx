"use client";

import { cn } from "@/lib/utils";

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function top5SharePorCliente(porCliente: unknown): { pct: number; topNome: string | null } {
  if (!Array.isArray(porCliente) || porCliente.length === 0) return { pct: 0, topNome: null };
  const vals = porCliente
    .map((p) => {
      const row = p as Record<string, unknown>;
      return { nome: String(row.nome ?? ""), valor: num(row.valor) };
    })
    .filter((x) => x.valor > 0);
  if (!vals.length) return { pct: 0, topNome: null };
  const tot = vals.reduce((a, b) => a + b.valor, 0);
  const sorted = [...vals].sort((a, b) => b.valor - a.valor);
  const top5 = sorted.slice(0, 5).reduce((a, b) => a + b.valor, 0);
  return { pct: tot > 0 ? (top5 / tot) * 100 : 0, topNome: sorted[0]?.nome ?? null };
}

function tonePct(pct: number): string {
  if (pct >= 70) return "text-red-300";
  if (pct >= 50) return "text-amber-200";
  return "text-emerald-300/90";
}

export function FinancialRiskPanel({
  faturamentoResumo,
  comercialRecomendacoes,
}: {
  faturamentoResumo: Record<string, unknown> | null;
  comercialRecomendacoes: Record<string, unknown> | null;
}) {
  const porCliente = faturamentoResumo?.porCliente;
  const { pct, topNome } = top5SharePorCliente(porCliente);
  const totalValor = num(faturamentoResumo?.totalValor);
  const qFat = num(faturamentoResumo?.quantidadeFaturamentos);

  const recs = (comercialRecomendacoes?.recomendacoes as Record<string, unknown>[] | undefined) ?? [];
  const margemAlerts = recs.filter((r) => String(r.titulo ?? "").toLowerCase().includes("margem"));
  const creditoAlerts = recs.filter(
    (r) =>
      String(r.titulo ?? "")
        .toLowerCase()
        .match(/inad|boleto|cr[eé]dito|pagar/) ||
      String(r.descricao ?? "")
        .toLowerCase()
        .match(/inad|boleto/),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-red-900/30 bg-[#0c0608]/90 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/80">Risco de crédito</p>
        <p className="mt-2 text-xs text-zinc-400">
          Sinalização a partir de <code className="text-zinc-500">/comercial/recomendacoes</code> (alertas de inadimplência / boletos) e volume
          faturado no período.
        </p>
        <ul className="mt-3 space-y-2 text-[11px]">
          {creditoAlerts.length ? (
            creditoAlerts.slice(0, 5).map((r, i) => (
              <li key={i} className="rounded border border-white/5 bg-black/30 p-2 text-zinc-300">
                <span className="font-semibold text-amber-200">{String(r.titulo)}</span>
                <p className="text-zinc-500">{String(r.descricao ?? "")}</p>
              </li>
            ))
          ) : (
            <li className="text-zinc-600">Nenhum alerta de crédito explícito na amostra atual.</li>
          )}
        </ul>
      </div>
      <div className="rounded-xl border border-amber-900/35 bg-[#0a0804]/90 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">Liquidez &amp; concentração</p>
        <p className="mt-2 font-mono text-sm text-white">
          Top-5 receita: <span className={cn("font-bold", tonePct(pct))}>{pct.toFixed(1)}%</span>
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Maior cliente no período: {topNome ?? "—"} · Faturamentos: {qFat} · Valor agregado (proxy): R${" "}
          {totalValor >= 1e6 ? `${(totalValor / 1e6).toFixed(2)}M` : totalValor.toLocaleString("pt-BR")}
        </p>
        <p className="mt-3 text-[10px] text-zinc-600">
          Concentração elevada amplifica risco de receita e negociação comercial; use em conjunto com curva ABC em{" "}
          <code className="text-zinc-500">/comercial/recomendacoes</code>.
        </p>
      </div>
      <div className="rounded-xl border border-rose-900/30 bg-[#0c080a]/90 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300/80">Risco de margem</p>
        <p className="mt-2 text-xs text-zinc-400">Recomendações com foco em margem, mix e precificação.</p>
        <ul className="mt-3 max-h-40 space-y-2 overflow-auto text-[11px]">
          {margemAlerts.length ? (
            margemAlerts.slice(0, 6).map((r, i) => (
              <li key={i} className="rounded border border-white/5 bg-black/25 p-2">
                <span className="text-rose-200/90">{String(r.titulo)}</span>
                <p className="text-zinc-500">{String(r.descricao ?? "")}</p>
              </li>
            ))
          ) : (
            <li className="text-zinc-600">Sem recomendações de margem na resposta — período ou regras neutras.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
