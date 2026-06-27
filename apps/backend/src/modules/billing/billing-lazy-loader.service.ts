import { Injectable, Logger } from '@nestjs/common';
import { LazyModuleLoader, ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

/**
 * Lazy-load do bundle de CRONs de faturamento (provisão diária).
 * Prioriza boot rápido para rotas Gate em FEATURE_PHASES=operational.
 */
@Injectable()
export class BillingLazyLoaderService {
  private readonly logger = new Logger(BillingLazyLoaderService.name);
  private loaded = false;
  private loading?: Promise<void>;

  constructor(
    private readonly lazyModuleLoader: LazyModuleLoader,
    private readonly config: ConfigService,
  ) {}

  isLazyEnabled(): boolean {
    return this.config.get<boolean>('featurePhases.billingCronLazy') === true;
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      this.logger.log('Lazy-load CRONs de faturamento e régua de cobrança');
      const [faturamentoRef, dunningRef]: ModuleRef[] = await Promise.all([
        this.lazyModuleLoader.load(() =>
          import('../../armazenagem-faturamento/armazenagem-faturamento-cron.module').then(
            (m) => m.ArmazenagemFaturamentoCronModule,
          ),
        ),
        this.lazyModuleLoader.load(() =>
          import('../../dunning/dunning-cron.module').then((m) => m.DunningCronModule),
        ),
      ]);
      void faturamentoRef;
      void dunningRef;
      this.loaded = true;
      this.logger.log('ArmazenagemFaturamentoCronModule e DunningCronModule carregados');
    })();

    return this.loading;
  }

  status(): { loaded: boolean; lazyEnabled: boolean } {
    return { loaded: this.loaded, lazyEnabled: this.isLazyEnabled() };
  }
}
