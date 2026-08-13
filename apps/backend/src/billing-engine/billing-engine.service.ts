import { Injectable } from '@nestjs/common';
import { BillingRuleEngineService } from './billing-rule-engine.service';

/** @deprecated Use BillingRuleEngineService — mantido para compatibilidade de rotas legadas. */
@Injectable()
export class BillingEngineService {
  constructor(private readonly rules: BillingRuleEngineService) {}

  resolveRegraForCliente(clienteId: string) {
    return this.rules.resolvePricingForCliente(clienteId);
  }

  async simular(clienteId: string, diasArmazenados: number) {
    const pricing = await this.rules.resolvePricingForCliente(clienteId);
    const gateInAt = new Date();
    gateInAt.setUTCDate(gateInAt.getUTCDate() - diasArmazenados);
    const evaluation = await this.rules.evaluateForContainerCycle({
      gateInAt,
      asOf: new Date(),
      regras: pricing.regras,
      container: { tamanho: '40', tipo: 'DRY', refrigerado: false },
      fase: 'GATE_OUT',
      clienteId,
    });
    return { total: evaluation.valorTotal, source: pricing.source, items: evaluation.items };
  }
}
