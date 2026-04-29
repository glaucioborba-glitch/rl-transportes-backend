import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { automacaoIntegracaoBus, type IntegracaoEventoBridgePayload } from '../automacao-integracao.bus';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { RegrasAutomacaoService } from '../regras/regras-automacao.service';

const MODULOS_ALVO = ['operacao', 'financeiro', 'fiscal', 'rh', 'grc', 'ia-preditiva', 'datahub'] as const;

@Injectable()
export class OrquestradorAutomacaoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrquestradorAutomacaoService.name);

  private readonly onIntegracaoEvento = (raw: IntegracaoEventoBridgePayload) => {
    void this.handleIntegracaoEvento(raw).catch((e) =>
      this.logger.error({ msg: 'automacao.orquestrador.erro', erro: (e as Error).message }),
    );
  };

  constructor(
    private readonly workflows: WorkflowEngineService,
    private readonly regras: RegrasAutomacaoService,
  ) {}

  onModuleInit() {
    automacaoIntegracaoBus.on('integracao.evento', this.onIntegracaoEvento);
  }

  onModuleDestroy() {
    automacaoIntegracaoBus.off('integracao.evento', this.onIntegracaoEvento);
  }

  private async handleIntegracaoEvento(p: IntegracaoEventoBridgePayload) {
    this.logger.log({
      msg: 'automacao.orquestrador.evento_recebido',
      tipo: p.tipo,
      clienteId: p.clienteId ?? null,
      correlationId: p.correlationId ?? null,
      modulos: MODULOS_ALVO,
    });

    await this.workflows.processarEvento(p.tipo, {
      ...p.payload,
      _meta: { clienteId: p.clienteId, correlationId: p.correlationId },
    });

    await this.regras.avaliarParaEvento(p.tipo, {
      ...p.payload,
      _meta: { clienteId: p.clienteId, correlationId: p.correlationId },
    });
  }
}
