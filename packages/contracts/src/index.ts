export const OBS_WS_CHANNEL = 'obs:ws:events';

export const BILLING_ELIGIBLE_INTENTS = [
  'SOLICITAR_BAIXA',
  'SOLICITAR_COLETA',
  'SOLICITAR_TRANSFERENCIA',
  'SOLICITAR_INSPECAO',
  'SOLICITAR_REPARO',
] as const;

export type BillingEligibleIntent = (typeof BILLING_ELIGIBLE_INTENTS)[number];

export type CondicaoPagamentoOption = {
  label: string;
  value: string;
};

export * from './container-mdm';
