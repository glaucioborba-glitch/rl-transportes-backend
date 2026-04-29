"use client";

export function FinancialForecastPanel(props: {
  forecastReceita: number;
  inadPct: number;
  ticketMedio: number;
}) {
  return (
    <div className="rounded-2xl border border-cyan-500/15 bg-[#061018]/90 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/80">Forecast financeiro</p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-200">
        Projetamos receita de aproximadamente{" "}
        <strong className="text-white">
          R$ {props.forecastReceita.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
        </strong>{" "}
        no próximo ciclo (proxy API), com inadimplência prevista em{" "}
        <strong className="text-white">{props.inadPct.toFixed(1)}%</strong>. Ticket médio observado{" "}
        <strong className="text-white">R$ {props.ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</strong>.
      </p>
    </div>
  );
}
