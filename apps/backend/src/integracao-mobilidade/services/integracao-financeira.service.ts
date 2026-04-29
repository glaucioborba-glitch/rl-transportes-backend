import { Injectable } from '@nestjs/common';
import type { IntegracaoTipoEvento } from '../integracao-events.constants';
import type { PagamentoWebhookDto } from '../dto/pagamento-webhook.dto';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Injectable()
export class IntegracaoFinanceiraService {
  constructor(private readonly webhook: WebhookDeliveryService) {}

  async processWebhook(dto: PagamentoWebhookDto) {
    let tipo: IntegracaoTipoEvento = 'pagamento.confirmado';
    if (dto.status === 'atrasado') tipo = 'pagamento.atrasado';
    if (dto.status === 'divergente') tipo = 'pagamento.divergente';

    const payload = {
      referencia: dto.referencia,
      valor: dto.valor,
      meio: dto.meio ?? null,
      status: dto.status,
      reconciliacao: 'pendente_fase_bancaria',
    };

    const entregas = await this.webhook.dispatch({
      tipo,
      payload,
      correlationId: dto.correlationId,
    });

    return {
      aceito: true,
      evento: tipo,
      entregasWebhooks: entregas.length,
      detalhe: 'Processamento somente em camada de integração; reconciliação financeira core permanece read-only nesta fase.',
    };
  }
}
