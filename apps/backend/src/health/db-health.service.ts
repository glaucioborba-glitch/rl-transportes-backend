import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type DbHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type DbHealthResult = {
  status: DbHealthStatus;
  latencyMs: number;
  activeConnections?: number;
};

@Injectable()
export class DbHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkConnection(): Promise<DbHealthResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;

      const poolStats = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint as count FROM pg_stat_activity
        WHERE state = 'active' AND datname = current_database()
      `;
      const activeConnections = Number(poolStats[0]?.count ?? 0);

      let status: DbHealthStatus = 'healthy';
      if (latencyMs >= 500) status = 'unhealthy';
      else if (latencyMs >= 100 || activeConnections > 40) status = 'degraded';

      return { status, latencyMs, activeConnections };
    } catch {
      return { status: 'unhealthy', latencyMs: Date.now() - start };
    }
  }
}
