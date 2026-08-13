import { Injectable } from '@nestjs/common';
import { ObservabilidadeTelemetryStore } from '../observabilidade/observabilidade-telemetry.store';
import { ObservabilityMetricsService } from './metrics.service';
import { ObservabilityLogsService } from './logs.service';

/** Facade única de telemetria HTTP (E3 #6). */
@Injectable()
export class ObservabilityFacadeService {
  constructor(
    private readonly telemetry: ObservabilidadeTelemetryStore,
    private readonly metrics: ObservabilityMetricsService,
    private readonly logs: ObservabilityLogsService,
  ) {}

  recordHttpRoundtrip(input: {
    requestId: string;
    path: string;
    method: string;
    statusCode: number;
    durationMs: number;
    usuarioId?: string;
    usuarioEmail?: string;
    clienteId?: string | null;
  }): void {
    void this.metrics.recordHttpRoundtrip({
      path: input.path,
      method: input.method,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      usuarioId: input.usuarioId,
    });

    if (input.statusCode >= 400) {
      void this.logs.recordException({
        path: input.path,
        message: `HTTP ${input.statusCode}`,
        statusCode: input.statusCode,
        level: input.statusCode >= 500 ? 'ERROR' : 'WARNING',
      });
    }

    this.telemetry.registrarHttpRoundtrip(input);
  }

  isRedisBackend() {
    return this.telemetry.isRedisBackendActive();
  }
}
