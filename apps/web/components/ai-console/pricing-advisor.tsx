"use client";

type Ind = { margemMediaPct?: number | null; elasticidadeDemandaMedia?: number | null };

export function PricingAdvisor({
  ind,
  margemPct,
}: {
  ind: Ind | null;
  margemPct: number;
}) {
  const e = ind?.elasticidadeDemandaMedia ?? 1;
  let decision = "Manter preço";
  let detail = "Elasticidade neutra para ajustes agressivos.";
  if (margemPct < 12 && e < 1.2) {
    decision = "Renegociar / pacote";
    detail = "Margem baixa e demanda pouco elástica — prefira pacotes e mix de serviços.";
  } else if (margemPct < 14 && e > 1.3) {
    decision = "Desconto progressivo seletivo";
    detail = "Demanda sensível — use desconto em faixas de volume para proteger receita.";
  } else if (margemPct > 18 && e < 1.1) {
    decision = "Subir preço seletivo";
    detail = "Margem confortável com baixa elasticidade — teste aumento em clientes A.";
  }

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80">Pricing advisor · front-only</p>
      <p className="mt-2 text-lg font-semibold text-white">{decision}</p>
      <p className="mt-1 text-xs text-zinc-400">{detail}</p>
      <p className="mt-3 font-mono text-[10px] text-zinc-500">
        Margem proxy {margemPct.toFixed(1)}% · elasticidade média {e.toFixed(2)}
      </p>
    </div>
  );
}
