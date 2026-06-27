import { Prisma, PrismaClient } from '@prisma/client';
import type { AuditContextService } from './audit-context.service';
import { captureModelMutation } from './audit-trail-capture.util';

type Db = PrismaClient;

async function safeCapture(
  client: Db,
  auditContext: AuditContextService,
  model: 'Fatura' | 'Solicitacao' | 'BloqueioContainer',
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

export function createAuditTrailExtension(auditContext: AuditContextService) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      query: {
        fatura: {
          async update({ args, query }) {
            const before = (await client.fatura.findUnique({
              where: args.where as Prisma.FaturaWhereUniqueInput,
            })) as Record<string, unknown> | null;
            const result = await query(args);
            void safeCapture(
              client as unknown as Db,
              auditContext,
              'Fatura',
              'update',
              before,
              result as Record<string, unknown> | null,
            );
            return result;
          },
          async delete({ args, query }) {
            const before = (await client.fatura.findUnique({
              where: args.where as Prisma.FaturaWhereUniqueInput,
            })) as Record<string, unknown> | null;
            const result = await query(args);
            void safeCapture(client as unknown as Db, auditContext, 'Fatura', 'delete', before, null);
            return result;
          },
        },
        solicitacao: {
          async update({ args, query }) {
            const before = (await client.solicitacao.findUnique({
              where: args.where as Prisma.SolicitacaoWhereUniqueInput,
            })) as Record<string, unknown> | null;
            const result = await query(args);
            void safeCapture(
              client as unknown as Db,
              auditContext,
              'Solicitacao',
              'update',
              before,
              result as Record<string, unknown> | null,
            );
            return result;
          },
          async delete({ args, query }) {
            const before = (await client.solicitacao.findUnique({
              where: args.where as Prisma.SolicitacaoWhereUniqueInput,
            })) as Record<string, unknown> | null;
            const result = await query(args);
            void safeCapture(client as unknown as Db, auditContext, 'Solicitacao', 'delete', before, null);
            return result;
          },
        },
        bloqueioContainer: {
          async update({ args, query }) {
            const before = (await client.bloqueioContainer.findUnique({
              where: args.where as Prisma.BloqueioContainerWhereUniqueInput,
            })) as Record<string, unknown> | null;
            const result = await query(args);
            void safeCapture(
              client as unknown as Db,
              auditContext,
              'BloqueioContainer',
              'update',
              before,
              result as Record<string, unknown> | null,
            );
            return result;
          },
          async delete({ args, query }) {
            const before = (await client.bloqueioContainer.findUnique({
              where: args.where as Prisma.BloqueioContainerWhereUniqueInput,
            })) as Record<string, unknown> | null;
            const result = await query(args);
            void safeCapture(client as unknown as Db, auditContext, 'BloqueioContainer', 'delete', before, null);
            return result;
          },
        },
      },
    }),
  );
}
