import type { Prisma, PrismaClient } from '@prisma/client';

export type TabelaAluguelAtribuicao = {
  id: string;
  nome: string;
  padrao: boolean;
};

function vigentesWhere(tenantId: string): Prisma.CadastroTabelaAluguelWhereInput {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return {
    tenantId,
    deletedAt: null,
    ativo: true,
    dataInicio: { lte: hoje },
    OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
  };
}

export async function listCadastroTabelasAluguelAtivas(
  db: PrismaClient,
  tenantId: string,
): Promise<TabelaAluguelAtribuicao[]> {
  return db.cadastroTabelaAluguel.findMany({
    where: { tenantId, deletedAt: null, ativo: true },
    select: { id: true, nome: true, padrao: true },
    orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
  });
}

export async function resolveCadastroTabelaAluguelPadraoId(
  db: PrismaClient,
  tenantId = 'default',
): Promise<string | null> {
  let vigentes = await db.cadastroTabelaAluguel.findMany({
    where: vigentesWhere(tenantId),
    select: { id: true, padrao: true },
    orderBy: [{ padrao: 'desc' }, { dataInicio: 'desc' }],
  });
  if (!vigentes.length && tenantId !== 'default') {
    vigentes = await db.cadastroTabelaAluguel.findMany({
      where: vigentesWhere('default'),
      select: { id: true, padrao: true },
      orderBy: [{ padrao: 'desc' }, { dataInicio: 'desc' }],
    });
  }
  return vigentes.find((t) => t.padrao)?.id ?? vigentes[0]?.id ?? null;
}
