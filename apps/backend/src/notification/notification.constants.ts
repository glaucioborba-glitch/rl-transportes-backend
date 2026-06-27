/** Evento outbox — processamento assíncrono com retry (padrão existente). */
export const OUTBOX_WHATSAPP_NOTIFY = 'WHATSAPP_NOTIFY';

export const AUDIT_ENTIDADE_NOTIFICACAO = 'NOTIFICACAO_WHATSAPP';
export const AUDIT_ACAO_WHATSAPP_SENT = 'WHATSAPP_SENT';

export type WhatsappNotifyKind =
  | 'OPERACIONAL_GATE_IN'
  | 'OPERACIONAL_ARMAZENADO'
  | 'FINANCEIRO_FATURA'
  | 'DUNNING_COBRANCA';

export type DunningNotifyStage =
  | 'PRE_VENCIMENTO'
  | 'VENCIMENTO_HOJE'
  | 'ATRASO_LEVE'
  | 'PRE_BLOQUEIO';

export type WhatsappNotifyPayload = {
  kind: WhatsappNotifyKind;
  /** Chave de idempotência (containerEventId, faturaId+outboxId, etc.). */
  dedupeKey: string;
  solicitacaoId?: string;
  clienteId?: string;
  faturaId?: string;
  containerIso: string;
  protocolo?: string;
  nomeDestinatario?: string;
  telefoneDestinatario?: string;
  eventAt?: string;
  valorTotal?: number;
  portalLink?: string;
  dunningStage?: DunningNotifyStage;
  faturaNumero?: string;
  dataVencimento?: string;
  diasAtraso?: number;
  messagePreview?: string;
};
