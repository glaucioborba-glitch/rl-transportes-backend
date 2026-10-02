import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolvePhaseImports } from '../modules/phase-imports';

@Injectable()
export class FeaturePhasesBootService implements OnModuleInit {
  private readonly logger = new Logger(FeaturePhasesBootService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    const phase = (this.config.get<string>('FEATURE_PHASES') ?? 'full').toLowerCase().trim();
    const lean = phase === 'operational' || phase === 'lean' || phase === '0';
    const phaseImports = resolvePhaseImports().map((m) => m.name);

    this.logger.log(
      `FEATURE_PHASES=${phase} (${lean ? 'operational/lean' : 'full'}) — lazy modules: [${phaseImports.join(', ')}]`,
    );

    if (nodeEnv === 'production' && !lean && this.config.get<string>('FEATURE_PHASES_FULL_OK') !== '1') {
      this.logger.warn(
        'Produção com FEATURE_PHASES=full carrega Enterprise/Analytics completos. ' +
          'Recomendado: FEATURE_PHASES=operational. Para manter full, defina FEATURE_PHASES_FULL_OK=1.',
      );
    }
  }
}
