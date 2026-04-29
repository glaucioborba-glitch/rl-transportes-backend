import type { PagamentoWebhookDto } from '../dto/pagamento-webhook.dto';

/** Assinatura determinística para validação opcional do webhook financeiro. */
export function canonicalPagamentoPayload(d: PagamentoWebhookDto): string {
  return JSON.stringify({
    correlationId: d.correlationId ?? null,
    meio: d.meio ?? null,
    referencia: d.referencia,
    status: d.status,
    valor: d.valor,
  });
}
