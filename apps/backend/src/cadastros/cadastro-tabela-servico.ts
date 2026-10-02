import type { Prisma, PrismaClient } from '@prisma/client';

export type TabelaServicoAtribuicao = {
  id: string;
  nome: string;
  padrao: boolean;
};

function vigentesWhere(tenantId: string): Prisma.CadastroTabelaServicoWhereInput {
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

export async function listCadastroTabelasServicoAtivas(
  db: PrismaClient,
  tenantId: string,
): Promise<TabelaServicoAtribuicao[]> {
  return db.cadastroTabelaServico.findMany({
    where: { tenantId, deletedAt: null, ativo: true },
    select: { id: true, nome: true, padrao: true },
    orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
  });
}

export async function resolveCadastroTabelaServicoPadraoId(
  db: PrismaClient,
  tenantId = 'default',
): Promise<string | null> {
  let vigentes = await db.cadastroTabelaServico.findMany({
    where: vigentesWhere(tenantId),
    select: { id: true, padrao: true },
    orderBy: [{ padrao: 'desc' }, { dataInicio: 'desc' }],
  });
  if (!vigentes.length && tenantId !== 'default') {
    vigentes = await db.cadastroTabelaServico.findMany({
      where: vigentesWhere('default'),
      select: { id: true, padrao: true },
      orderBy: [{ padrao: 'desc' }, { dataInicio: 'desc' }],
    });
  }
  return vigentes.find((t) => t.padrao)?.id ?? vigentes[0]?.id ?? null;
}
