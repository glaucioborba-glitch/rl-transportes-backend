import type { PrismaClient } from '@prisma/client';
import { resolveBillingTabelaPrecoIdPadrao } from '../cadastros/cadastro-tabela-preco-vigente';

export type PurgeOrphanBillingResult = {
  deleted: { id: string; nome: string }[];
  redirected: number;
};

/**
 * Remove tabelas de billing sem cadastro em /cadastros/financeiro/tabelas-precos
 * e aponta clientes para a tabela cadastral padrão.
 */
export async function purgeOrphanBillingTables(
  db: PrismaClient,
  tenantId = 'default',
): Promise<PurgeOrphanBillingResult> {
  const orphans = await db.tabelaPreco.findMany({
    where: { tenantId, cadastroTabelaPreco: { is: null } },
    select: { id: true, nome: true },
  });
  if (!orphans.length) {
    return { deleted: [], redirected: 0 };
  }

  const keepId = await resolveBillingTabelaPrecoIdPadrao(db, tenantId);
  let redirected = 0;

  for (const orphan of orphans) {
    if (keepId && keepId !== orphan.id) {
      const upd = await db.cliente.updateMany({
        where: { tabelaPrecoId: orphan.id },
        data: { tabelaPrecoId: keepId },
      });
      redirected += upd.count;
    } else {
      const upd = await db.cliente.updateMany({
        where: { tabelaPrecoId: orphan.id },
        data: { tabelaPrecoId: null },
      });
      redirected += upd.count;
    }
    await db.tabelaPreco.delete({ where: { id: orphan.id } });
  }

  return { deleted: orphans, redirected };
}

/** Garante uma tabela cadastral marcada como padrão do terminal. */
export async function ensureCadastroTabelaPadrao(
  db: PrismaClient,
  tenantId = 'default',
): Promise<string | null> {
  const current = await db.cadastroTabelaPreco.findFirst({
    where: { tenantId, padrao: true, deletedAt: null, ativo: true },
    select: { id: true, billingTabelaPrecoId: true },
  });
  if (current) {
    if (current.billingTabelaPrecoId) {
      await db.tabelaPreco.updateMany({
        where: { id: current.billingTabelaPrecoId },
        data: { padrao: true },
      });
    }
    return current.id;
  }

  const fallback = await db.cadastroTabelaPreco.findFirst({
    where: { tenantId, deletedAt: null, ativo: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, billingTabelaPrecoId: true },
  });
  if (!fallback) return null;

  await db.cadastroTabelaPreco.update({
    where: { id: fallback.id },
    data: { padrao: true },
  });
  if (fallback.billingTabelaPrecoId) {
    await db.tabelaPreco.update({
      where: { id: fallback.billingTabelaPrecoId },
      data: { padrao: true },
    });
  }
  return fallback.id;
}
