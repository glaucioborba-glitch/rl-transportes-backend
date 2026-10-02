import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';

const DEGRADED_THRESHOLD_MS = 500;

/**
 * Sonda Redis + caminho semelhante ao Security Engine (DB read leve).
 * Redis indisponível → offline; tempo total > 500ms → degraded.
 */
export async function probeSecurityEngineStatus(
  redis: RedisService,
  prisma: PrismaService,
): Promise<'ok' | 'degraded' | 'offline'> {
  const t0 = Date.now();
  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') return 'offline';
    await redis.get('health:security-engine-probe');
    await prisma.$queryRaw`SELECT 1`;
    const elapsed = Date.now() - t0;
    return elapsed > DEGRADED_THRESHOLD_MS ? 'degraded' : 'ok';
  } catch {
    return 'offline';
  }
}
