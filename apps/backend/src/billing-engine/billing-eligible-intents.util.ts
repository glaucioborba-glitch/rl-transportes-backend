import { TipoOperacaoSolicitacaoIntent } from '@prisma/client';

/** Intents operacionais que disparam provisão / fechamento de armazenagem no gate. */
export const BILLING_ELIGIBLE_INTENTS = [
  TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_TRANSFERENCIA,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_INSPECAO,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_REPARO,
] as const;

export type BillingEligibleIntent = (typeof BILLING_ELIGIBLE_INTENTS)[number];

const ELIGIBLE_SET = new Set<string>(BILLING_ELIGIBLE_INTENTS);

export function isBillingEligibleIntent(
  intent: TipoOperacaoSolicitacaoIntent | null | undefined,
): boolean {
  if (intent == null) return true;
  return ELIGIBLE_SET.has(intent);
}
