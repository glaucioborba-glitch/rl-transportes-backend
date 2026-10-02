import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const CRON_LAST_RUN = 'cron:last_run';
const CRON_FAIL_DEDUP = 'cron:fail:dedup:';

@Injectable()
export class CronAlertService {
  private readonly logger = new Logger(CronAlertService.name);

  constructor(private readonly redis: RedisService) {}

  async recordSuccess(jobId: string): Promise<void> {
    const payload = JSON.stringify({ jobId, ok: true, at: new Date().toISOString() });
    await this.redis.hset(CRON_LAST_RUN, jobId, payload);
  }

  async recordFailure(jobId: string, error: unknown): Promise<void> {
    const msg = error instanceof Error ? error.message : String(error);
    const payload = JSON.stringify({ jobId, ok: false, at: new Date().toISOString(), error: msg });
    await this.redis.hset(CRON_LAST_RUN, jobId, payload);

    const dedupKey = `${CRON_FAIL_DEDUP}${jobId}`;
    const seen = await this.redis.setNxEx(dedupKey, 3600, '1');
    if (seen) {
      this.logger.error(`CRON ${jobId} falhou: ${msg}`);
    }
  }

  async getStatuses(): Promise<Record<string, { ok: boolean; at: string; error?: string }>> {
    const raw = await this.redis.hgetall(CRON_LAST_RUN);
    const out: Record<string, { ok: boolean; at: string; error?: string }> = {};
    for (const [jobId, json] of Object.entries(raw)) {
      try {
        const p = JSON.parse(json) as { ok: boolean; at: string; error?: string };
        out[jobId] = p;
      } catch {
        /* skip */
      }
    }
    return out;
  }

  async runSafe<T>(jobId: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      const result = await fn();
      await this.recordSuccess(jobId);
      return result;
    } catch (e) {
      await this.recordFailure(jobId, e);
      throw e;
    }
  }
}
