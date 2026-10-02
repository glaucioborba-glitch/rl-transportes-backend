import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DATAHUB_MV_NAMES } from '../datahub-mv.constants';

@Injectable()
export class DatahubMvRefreshService {
  private readonly logger = new Logger(DatahubMvRefreshService.name);
  private lastRefreshAt: Date | null = null;

  constructor(private readonly prisma: PrismaService) {}

  getLastRefreshAt(): string | null {
    return this.lastRefreshAt?.toISOString() ?? null;
  }

  async refreshAll(): Promise<{ ok: boolean; views: string[] }> {
    const refreshed: string[] = [];
    for (const view of DATAHUB_MV_NAMES) {
      try {
        await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
        refreshed.push(view);
      } catch (e) {
        this.logger.warn(
          `Refresh ${view} falhou (tentando sem CONCURRENTLY): ${e instanceof Error ? e.message : e}`,
        );
        await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW ${view}`);
        refreshed.push(view);
      }
    }
    this.lastRefreshAt = new Date();
    this.logger.log(`Datahub MVs atualizadas: ${refreshed.join(', ')}`);
    return { ok: true, views: refreshed };
  }
}
