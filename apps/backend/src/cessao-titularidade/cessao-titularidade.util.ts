import type { StatusPagamentoFatura, StatusUnidadeProcesso } from '@prisma/client';

export type EtapaCessao = 'DURANTE_ESTADIA' | 'POS_SAIDA' | 'POS_NFSE';

export function nfseJaEmitida(fatura: {
  linkNfse?: string | null;
  numeroRps?: string | null;
} | null | undefined): boolean {
  if (!fatura) return false;
  return Boolean(fatura.linkNfse?.trim() || fatura.numeroRps?.trim());
}

export function inferirEtapaCessao(input: {
  statusProcesso: StatusUnidadeProcesso | string;
  fatura?: {
    linkNfse?: string | null;
    numeroRps?: string | null;
    statusPagamento?: StatusPagamentoFatura | string | null;
  } | null;
}): EtapaCessao {
  if (input.statusProcesso === 'ABERTO') return 'DURANTE_ESTADIA';
  if (nfseJaEmitida(input.fatura)) return 'POS_NFSE';
  return 'POS_SAIDA';
}

export function faturaImpedeCessao(status?: StatusPagamentoFatura | string | null): boolean {
  return status === 'PAGO';
}
