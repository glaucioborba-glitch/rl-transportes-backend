import { Injectable } from '@nestjs/common';
import { normalizarIdentificadorVeicular } from '../common/integracao-string.util';
import type { IntegracaoTipoEvento } from '../integracao-events.constants';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Injectable()
export class IntegracaoVisaoService {
  constructor(private readonly webhook: WebhookDeliveryService) {}

  async ingestCamera(input: {
    provedor?: string;
    placas?: string[];
    imagemBase64?: string;
    correlationId?: string;
  }) {
    const placas = (input.placas ?? []).map((p) => normalizarIdentificadorVeicular(p));
    await this.webhook.dispatch({
      tipo: 'ocr.normalizado',
      payload: {
        provedor: input.provedor ?? 'desconhecido',
        placas,
        imagemTamanho: input.imagemBase64?.length ?? 0,
      },
      correlationId: input.correlationId,
    });
    return { placasNormalizadas: placas };
  }

  async ingestGate(input: {
    protocolo?: string;
    placa?: string;
    correlationId?: string;
  }) {
    const placa = input.placa ? normalizarIdentificadorVeicular(input.placa) : null;
    const tipo: IntegracaoTipoEvento = 'gate.registrado';
    await this.webhook.dispatch({
      tipo,
      payload: { protocolo: input.protocolo ?? null, placa },
      correlationId: input.correlationId,
    });
    return { placa };
  }
}
