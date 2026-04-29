import type { MesValor } from '../planejamento-estrategico/planejamento-estrategico.calculations';

export interface FluxoCaixaParams {
  horizonteDias: 7 | 30 | 90;
  saldoInicialProxy: number;
  entradasEsperadasPeriodo: number;
  custosFixosMensais: number;
  saidasComprometidasPeriodo: number;
}

export interface FluxoCaixaResultado {
  horizonteDias: number;
  saldoProjetadoFim: number;
  entradasPrevistas: number;
  saidasPrevistas: number;
  diasUteisConsiderados: number;
}

export function projetarFluxoCaixa(p: FluxoCaixaParams): FluxoCaixaResultado {
  const dias = p.horizonteDias;
  const custoLinearPeriodo = (p.custosFixosMensais / 30) * dias;
  const saidas = custoLinearPeriodo + p.saidasComprometidasPeriodo * Math.min(1, dias / 30);
  const entradas = p.entradasEsperadasPeriodo;
  const saldoFim = p.saldoInicialProxy + entradas - saidas;

  return {
    horizonteDias: dias,
    saldoProjetadoFim: Math.round(saldoFim * 100) / 100,
    entradasPrevistas: Math.round(entradas * 100) / 100,
    saidasPrevistas: Math.round(saidas * 100) / 100,
    diasUteisConsiderados: dias,
  };
}

export function agregarSerie12Meses(receita: MesValor[], margemPctMedia: number): {
  receita: MesValor[];
  margem: MesValor[];
  caixa: MesValor[];
} {
  const fMargem = Math.min(0.45, Math.max(0.08, margemPctMedia / 100));
  const receitaOut = receita.map((m) => ({
    mes: m.mes,
    valor: Math.round(m.valor * 100) / 100,
  }));
  const margemOut = receita.map((m) => ({
    mes: m.mes,
    valor: Math.round(m.valor * fMargem * 100) / 100,
  }));
  const caixaOut = receita.map((m, i) => {
    const mg = margemOut[i]?.valor ?? 0;
    const cx = m.valor * 0.88 - mg * 0.12;
    return { mes: m.mes, valor: Math.round(cx * 100) / 100 };
  });
  return { receita: receitaOut, margem: margemOut, caixa: caixaOut };
}
