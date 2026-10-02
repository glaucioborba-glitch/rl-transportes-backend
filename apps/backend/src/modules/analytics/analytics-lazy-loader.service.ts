import { Injectable, Logger } from '@nestjs/common';
import { LazyModuleLoader, ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

/**
 * Carrega sob demanda o bundle Analytics (BI/relatórios) — libera RAM no boot operacional.
 */
@Injectable()
export class AnalyticsLazyLoaderService {
  private readonly logger = new Logger(AnalyticsLazyLoaderService.name);
  private loaded = false;
  private loading?: Promise<void>;

  constructor(
    private readonly lazyModuleLoader: LazyModuleLoader,
    private readonly config: ConfigService,
  ) {}

  isLazyEnabled(): boolean {
    return this.config.get<boolean>('featurePhases.analyticsLazy') !== false;
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      this.logger.log('Lazy-load AnalyticsDomainModule (BI / relatórios)');
      const ref: ModuleRef = await this.lazyModuleLoader.load(() =>
        import('./analytics-domain.module').then((m) => m.AnalyticsDomainModule),
      );
      void ref;
      this.loaded = true;
      this.logger.log('AnalyticsDomainModule carregado');
    })();

    return this.loading;
  }

  status(): { loaded: boolean; lazyEnabled: boolean } {
    return { loaded: this.loaded, lazyEnabled: this.isLazyEnabled() };
  }
}
