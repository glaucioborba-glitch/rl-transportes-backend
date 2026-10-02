import { diffDiasAtraso } from './finance-profile.util';

export type MoraCalculation = {
  diasAtraso: number;
  valorMulta: number;
  valorJuros: number;
  valorAtualizado: number;
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Multa única + juros simples pro rata die (juros a.m. / 30 × dias de atraso).
 * Valor base = valor original da fatura/boleto.
 */
export function calcularMora(params: {
  valorOriginal: number;
  dataVencimento: Date;
  asOf?: Date;
  percentualMultaAtraso: number;
  percentualJurosAoMes: number;
}): MoraCalculation {
  const valorOriginal = roundMoney(params.valorOriginal);
  const diasAtraso = diffDiasAtraso(params.dataVencimento, params.asOf);

  if (diasAtraso <= 0) {
    return {
      diasAtraso: 0,
      valorMulta: 0,
      valorJuros: 0,
      valorAtualizado: valorOriginal,
    };
  }

  const valorMulta = roundMoney(valorOriginal * (params.percentualMultaAtraso / 100));
  const valorJuros = roundMoney(
    valorOriginal * ((params.percentualJurosAoMes / 30) / 100) * diasAtraso,
  );

  return {
    diasAtraso,
    valorMulta,
    valorJuros,
    valorAtualizado: roundMoney(valorOriginal + valorMulta + valorJuros),
  };
}
