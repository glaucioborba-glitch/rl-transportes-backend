import { Injectable } from '@nestjs/common';
import { BiAnalyticsRefreshService } from '../bi-analytics/bi-analytics.service';
import { DatahubMvRefreshService } from '../datahub/services/datahub-mv-refresh.service';

/** Facade CQRS — refresh unificado de read models (BI + Datahub). */
@Injectable()
export class ReadModelsRefreshService {
  constructor(
    private readonly bi: BiAnalyticsRefreshService,
    private readonly datahub: DatahubMvRefreshService,
  ) {}

  async refreshAll(): Promise<{ bi: string[]; datahub: string[] }> {
    const [bi, dh] = await Promise.all([this.bi.refreshAll(), this.datahub.refreshAll()]);
    return { bi: bi.views, datahub: dh.views };
  }
}
