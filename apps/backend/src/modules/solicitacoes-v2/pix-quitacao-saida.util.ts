import { ConflictException } from '@nestjs/common';
import { toMoneyNumber } from '../../conta-corrente/conta-corrente.util';

export const PIX_QUITACAO_SALDO_INSUFICIENTE = 'SALDO_CONTA_COMERCIAL_INSUFICIENTE';

export type CotacaoPixIdItem = {
  unidadeIso: string;
  unidadeProcessoId: string;
  unidadeProcessoNumero: number;
  unidadeProcessoLabel: string;
  valor: number;
};

export type CotacaoPixSaida = {
  exigido: boolean;
  suficiente: boolean;
  saldo: number;
  valor: number;
  saldoApos: number;
  ids: CotacaoPixIdItem[];
};

export function formatBrlPix(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function mensagemSaldoInsuficiente(quote: CotacaoPixSaida): string {
  const falta = toMoneyNumber(Math.max(0, quote.valor - quote.saldo));
  return (
    `Saldo insuficiente na conta comercial para quitar este ID. ` +
    `Saldo atual ${formatBrlPix(quote.saldo)}; valor a quitar ${formatBrlPix(quote.valor)}; ` +
    `falta ${formatBrlPix(falta)}. Recarregue a conta via PIX e tente novamente.`
  );
}

export function conflictSaldoInsuficiente(quote: CotacaoPixSaida): ConflictException {
  return new ConflictException({
    code: PIX_QUITACAO_SALDO_INSUFICIENTE,
    message: mensagemSaldoInsuficiente(quote),
    saldo: quote.saldo,
    valor: quote.valor,
    saldoApos: quote.saldoApos,
    ids: quote.ids,
  });
}

export function montarDescricaoQuitacao(params: {
  protocolo: number | string;
  ids: CotacaoPixIdItem[];
}): string {
  const idsTxt = params.ids
    .map((i) => `${i.unidadeProcessoLabel} (${i.unidadeIso})`)
    .join(', ');
  return `Quitação PIX do ${idsTxt} na solicitação protocolo ${params.protocolo}`.slice(0, 500);
}
