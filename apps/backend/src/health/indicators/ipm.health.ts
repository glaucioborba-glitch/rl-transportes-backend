import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { FiscalIpmService } from '../../fiscal-integracao/fiscal-ipm.service';
import { AlertService } from '../../alert/alert.service';

@Injectable()
export class IpmHealthIndicator extends HealthIndicator {
  constructor(
    private readonly fiscal: FiscalIpmService,
    private readonly alerts: AlertService,
  ) {
    super();
  }

  async ping(key = 'fiscal_ipm'): Promise<HealthIndicatorResult> {
    const probe = await this.fiscal.probeConnectivity();
    if (probe.ok) {
      return this.getStatus(key, true, {
        latencyMs: probe.latencyMs,
        mode: probe.mode,
      });
    }

    void this.alerts.fiscalIpmDown({
      latencyMs: probe.latencyMs,
      reason: probe.reason,
    });

    throw new HealthCheckError(
      'API IPM / Prefeitura indisponível',
      this.getStatus(key, false, {
        latencyMs: probe.latencyMs,
        mode: probe.mode,
        reason: probe.reason,
      }),
    );
  }
}
