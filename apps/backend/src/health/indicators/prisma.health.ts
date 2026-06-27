import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async ping(key = 'database'): Promise<HealthIndicatorResult> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true, { latencyMs: Date.now() - started });
    } catch (e) {
      throw new HealthCheckError(
        'PostgreSQL indisponível',
        this.getStatus(key, false, { message: (e as Error).message }),
      );
    }
  }
}
