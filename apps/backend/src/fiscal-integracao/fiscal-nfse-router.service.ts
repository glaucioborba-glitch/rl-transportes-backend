import { Injectable, Logger } from '@nestjs/common';
import type { Cliente, Fatura } from '@prisma/client';
import { AlertService } from '../alert/alert.service';
import { NfseNacionalService } from '../nfse-nacional/nfse-nacional.service';
import { RetriableOutboxError } from '../outbox/outbox.errors';
import { FiscalIpmService } from './fiscal-ipm.service';
import type { FiscalEmissaoResult } from './fiscal-integracao.types';

export type ContextoEmissao = {
  containerIso: string;
  diasCobrados: number;
  gateOutAt: Date;
  outboxId: string;
};

export type ProvedorNfse = 'ipm' | 'nacional';

export type EmissaoRoteada = FiscalEmissaoResult & {
  /** Quem emitiu de fato — vai para NfsEmitida.provedor. */
  provedor: ProvedorNfse;
  /** Preenchido quando o Nacional entrou por queda do IPM. */
  motivoContingencia?: string;
};

/**
 * Decide quem emite a NFS-e. O IPM municipal é o titular; o Emissor Nacional
 * entra quando o IPM cai (ativação CONTINGENCIA) ou assume tudo (SEMPRE).
 */
@Injectable()
export class FiscalNfseRouterService {
  private readonly logger = new Logger(FiscalNfseRouterService.name);

  constructor(
    private readonly ipm: FiscalIpmService,
    private readonly nacional: NfseNacionalService,
    private readonly alerts: AlertService,
  ) {}

  usesRealIpm(): boolean {
    return this.ipm.usesRealIpm();
  }

  async emitirParaFatura(
    fatura: Fatura,
    cliente: Cliente,
    ctx: ContextoEmissao,
  ): Promise<EmissaoRoteada> {
    const cfgNacional = await this.nacional.config(fatura.tenantId);
    const nacionalDisponivel = cfgNacional.configured && cfgNacional.ativacao !== 'DESLIGADO';

    if (nacionalDisponivel && cfgNacional.ativacao === 'SEMPRE') {
      const r = await this.nacional.emitirParaFatura(fatura, cliente, ctx, fatura.tenantId);
      return { ...r, provedor: 'nacional' };
    }

    try {
      const r = await this.ipm.emitirParaFatura(fatura, cliente, ctx);
      return { ...r, provedor: 'ipm' };
    } catch (e) {
      const indisponivel = e instanceof RetriableOutboxError;
      if (!indisponivel || !nacionalDisponivel) throw e;

      const motivo = e instanceof Error ? e.message : String(e);
      this.logger.warn(`IPM indisponível — emitindo pelo Emissor Nacional. Motivo: ${motivo}`);

      try {
        const r = await this.nacional.emitirParaFatura(fatura, cliente, ctx, fatura.tenantId);
        void this.alerts.fiscalIpmDown({
          reason: `${motivo}. Contingência: NFS-e emitida pelo Emissor Nacional (${cfgNacional.ambiente}).`,
        });
        return { ...r, provedor: 'nacional', motivoContingencia: motivo };
      } catch (falhaNacional) {
        const detalhe = falhaNacional instanceof Error ? falhaNacional.message : String(falhaNacional);
        this.logger.error(`Contingência do Emissor Nacional também falhou: ${detalhe}`);
        // Mantém o erro do IPM como retriável para o outbox tentar de novo.
        throw new RetriableOutboxError(`${motivo} | Emissor Nacional: ${detalhe}`);
      }
    }
  }
}
