import { Prisma } from '@prisma/client';

const RETRYABLE_CODES = new Set(['P1017', 'P2028', 'P1001']);

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code && RETRYABLE_CODES.has(code)) return true;
  const message = (error as Error).message ?? '';
  return message.includes('ECONNREFUSED') || message.includes('Connection terminated');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelayMs: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt >= maxRetries) {
        throw error;
      }
      const code = (error as { code?: string }).code ?? 'connection';
      console.warn(`[Prisma] Retry ${attempt}/${maxRetries} após erro ${code}`);
      await delay(baseDelayMs * attempt);
    }
  }
  throw lastError;
}

/** Extension Prisma — retry automático em falhas transitórias de conexão (P1017/P2028/P1001). */
export function createPrismaRetryExtension(
  maxRetries = 3,
  baseDelayMs = 1000,
): ReturnType<typeof Prisma.defineExtension> {
  return Prisma.defineExtension({
    name: 'prisma-retry',
    query: {
      $allOperations({ args, query }) {
        return withRetry(() => query(args), maxRetries, baseDelayMs);
      },
    },
  });
}
