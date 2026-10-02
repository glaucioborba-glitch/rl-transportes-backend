import type { Prisma, PrismaClient } from '@prisma/client';

function vigenciaHoje() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

function vigentesWhere(tenantId: string): Prisma.CadastroTabelaTransporteWhereInput {
  const hoje = vigenciaHoje();
  return {
    tenantId,
    deletedAt: null,
    ativo: true,
    dataInicio: { lte: hoje },
    OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
  };
}

export type TabelaTransporteAtribuicao = {
  id: string;
  nome: string;
  padrao: boolean;
};

export async function listCadastroTabelasTransporteVigentes(
  db: PrismaClient,
  tenantId: string,
): Promise<TabelaTransporteAtribuicao[]> {
  const rows = await db.cadastroTabelaTransporte.findMany({
    where: vigentesWhere(tenantId),
    select: { id: true, nome: true, padrao: true },
    orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
  });
  return rows;
}

export async function listCadastroTabelasTransporteAtivas(
  db: PrismaClient,
  tenantId: string,
): Promise<TabelaTransporteAtribuicao[]> {
  const rows = await db.cadastroTabelaTransporte.findMany({
    where: { tenantId, deletedAt: null, ativo: true },
    select: { id: true, nome: true, padrao: true },
    orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
  });
  return rows;
}

export async function resolveCadastroTabelaTransportePadraoId(
  db: PrismaClient,
  tenantId = 'default',
): Promise<string | null> {
  let vigentes = await listCadastroTabelasTransporteVigentes(db, tenantId);
  if (!vigentes.length && tenantId !== 'default') {
    vigentes = await listCadastroTabelasTransporteVigentes(db, 'default');
  }
  return vigentes.find((t) => t.padrao)?.id ?? vigentes[0]?.id ?? null;
}
