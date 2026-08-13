import { Prisma, PrismaClient } from '@prisma/client';
import type { AuditContextService } from './audit-context.service';
import { captureModelMutation } from './audit-trail-capture.util';
import {
  AUDITED_MODEL_DELEGATES,
  AUDITED_PRISMA_MODELS,
  type AuditedPrismaModel,
} from './audit-trail.models';

type Db = PrismaClient;

async function safeCapture(
  client: Db,
  auditContext: AuditContextService,
  model: AuditedPrismaModel,
  operation: 'update' | 'delete',
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<void> {
  try {
    await captureModelMutation(client, auditContext.resolveActor(), model, operation, before, after);
  } catch {
    /* auditoria não deve derrubar transação operacional */
  }
}

type QueryHookArgs = {
  args: { where: unknown };
  query: (args: unknown) => Promise<unknown>;
};

function buildModelHooks(
  client: Db,
  auditContext: AuditContextService,
  model: AuditedPrismaModel,
  delegateKey: string,
) {
  const delegate = (client as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown> }>)[
    delegateKey
  ];

  return {
    async update({ args, query }: QueryHookArgs) {
      const before = delegate
        ? ((await delegate.findUnique({ where: args.where })) as Record<string, unknown> | null)
        : null;
      const result = await query(args);
      void safeCapture(client, auditContext, model, 'update', before, result as Record<string, unknown> | null);
      return result;
    },
    async delete({ args, query }: QueryHookArgs) {
      const before = delegate
        ? ((await delegate.findUnique({ where: args.where })) as Record<string, unknown> | null)
        : null;
      const result = await query(args);
      void safeCapture(client, auditContext, model, 'delete', before, null);
      return result;
    },
  };
}

export function createAuditTrailExtension(auditContext: AuditContextService) {
  return Prisma.defineExtension((client) => {
    const query: Record<string, ReturnType<typeof buildModelHooks>> = {};
    for (const model of AUDITED_PRISMA_MODELS) {
      const delegateKey = AUDITED_MODEL_DELEGATES[model];
      query[delegateKey] = buildModelHooks(client as unknown as Db, auditContext, model, delegateKey);
    }
    return client.$extends({ query: query as never });
  });
}
