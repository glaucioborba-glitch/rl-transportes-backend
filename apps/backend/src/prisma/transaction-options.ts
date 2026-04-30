import { Prisma } from '@prisma/client';

/** Política única de transações críticas (alinhada a compliance / SERIALIZABLE). */
export const PRISMA_SERIALIZABLE_TX = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 15000,
} as const;

/** Mesma política com timeout maior para integrações externas (ex.: NFS-e IPM). */
export const PRISMA_SERIALIZABLE_TX_EXTERNAL = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 20000,
} as const;
