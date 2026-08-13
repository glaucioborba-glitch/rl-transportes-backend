/** Valores canônicos persistidos em `boletos.statusPagamento` e `faturamentos.statusBoleto`. */
export const BOLETO_STATUS = {
  PENDENTE: 'pendente',
  PAGO: 'pago',
  VENCIDO: 'vencido',
  CANCELADO: 'cancelado',
} as const;

export type BoletoStatusValue = (typeof BOLETO_STATUS)[keyof typeof BOLETO_STATUS];

export function normalizeBoletoStatus(status: string): BoletoStatusValue | string {
  return status.trim().toLowerCase();
}

export function isBoletoPago(status: string): boolean {
  return normalizeBoletoStatus(status) === BOLETO_STATUS.PAGO;
}

export function isBoletoCancelado(status: string): boolean {
  return normalizeBoletoStatus(status) === BOLETO_STATUS.CANCELADO;
}

export function isBoletoVencido(status: string): boolean {
  return normalizeBoletoStatus(status) === BOLETO_STATUS.VENCIDO;
}

export function isBoletoPendente(status: string): boolean {
  return normalizeBoletoStatus(status) === BOLETO_STATUS.PENDENTE;
}

/** Status em aberto (pendente ou vencido) — lowercase exato para Prisma `where`. */
export const BOLETO_STATUS_ABERTO: BoletoStatusValue[] = [
  BOLETO_STATUS.PENDENTE,
  BOLETO_STATUS.VENCIDO,
];

/** Excluídos de inadimplência / aging (inclui legado uppercase durante transição). */
export const BOLETO_STATUS_ENCERRADO = [
  BOLETO_STATUS.PAGO,
  BOLETO_STATUS.CANCELADO,
  'PAGO',
  'CANCELADO',
] as const;

export const BOLETO_STATUS_NAO_PAGO = [
  BOLETO_STATUS.PENDENTE,
  BOLETO_STATUS.VENCIDO,
  'PENDENTE',
  'VENCIDO',
] as const;
