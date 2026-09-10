import type { CadastroTabelaPrecoItem, Prisma, PrismaClient } from '@prisma/client';

type CadastroTabelaComItens = Prisma.CadastroTabelaPrecoGetPayload<{
  include: { itens: true };
}>;

function vigenciaHoje() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

function vigentesWhere(tenantId: string): Prisma.CadastroTabelaPrecoWhereInput {
  const hoje = vigenciaHoje();
  return {
    tenantId,
    deletedAt: null,
    ativo: true,
    dataInicio: { lte: hoje },
    OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
  };
}

function ativasWhere(tenantId: string): Prisma.CadastroTabelaPrecoWhereInput {
  return { tenantId, deletedAt: null, ativo: true };
}

export function labelTabelaPrecoCadastro(t: { nome: string; padrao: boolean }): string {
  return t.padrao ? `${t.nome} (padrão)` : t.nome;
}

/** Ordena: tabela atribuída ao cliente → vínculo legado na tabela → padrão → demais. */
export function ordenarTabelasCandidatas<
  T extends {
    id: string;
    billingTabelaPrecoId: string | null;
    clienteId: string | null;
    padrao: boolean;
  },
>(tabelas: T[], opts: { billingTabelaPrecoId?: string | null; clienteId?: string }): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const push = (row?: T) => {
    if (!row || seen.has(row.id)) return;
    seen.add(row.id);
    out.push(row);
  };
  if (opts.billingTabelaPrecoId) {
    push(tabelas.find((t) => t.billingTabelaPrecoId === opts.billingTabelaPrecoId));
  }
  if (opts.clienteId) {
    push(tabelas.find((t) => t.clienteId === opts.clienteId));
  }
  push(tabelas.find((t) => t.padrao));
  for (const t of tabelas) push(t);
  return out;
}

export async function listCadastroTabelasVigentes(
  db: PrismaClient,
  tenantId: string,
): Promise<CadastroTabelaComItens[]> {
  return db.cadastroTabelaPreco.findMany({
    where: vigentesWhere(tenantId),
    include: { itens: true },
    orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
  });
}

export async function listCadastroTabelasAtivas(
  db: PrismaClient,
  tenantId: string,
): Promise<CadastroTabelaComItens[]> {
  return db.cadastroTabelaPreco.findMany({
    where: ativasWhere(tenantId),
    include: { itens: true },
    orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
  });
}

export async function resolveCadastroTabelasCandidatas(
  db: PrismaClient,
  clienteId: string,
): Promise<CadastroTabelaComItens[]> {
  const cliente = await db.cliente.findFirst({
    where: { id: clienteId, deletedAt: null },
    select: { tabelaPrecoId: true, tenantId: true },
  });
  const tenantId = cliente?.tenantId ?? 'default';
  let vigentes = await listCadastroTabelasVigentes(db, tenantId);
  if (!vigentes.length && tenantId !== 'default') {
    vigentes = await listCadastroTabelasVigentes(db, 'default');
  }
  return ordenarTabelasCandidatas(vigentes, {
    billingTabelaPrecoId: cliente?.tabelaPrecoId,
    clienteId,
  });
}

export async function resolveCadastroTabelaVigente(
  db: PrismaClient,
  clienteId: string,
): Promise<CadastroTabelaComItens | null> {
  const ordered = await resolveCadastroTabelasCandidatas(db, clienteId);
  return ordered[0] ?? null;
}

export async function resolveBillingTabelaPrecoIdPadrao(
  db: PrismaClient,
  tenantId = 'default',
): Promise<string | null> {
  const vigentes = await listCadastroTabelasVigentes(db, tenantId);
  const padrao = vigentes.find((t) => t.padrao) ?? vigentes[0];
  return padrao?.billingTabelaPrecoId ?? null;
}

export type TabelaPrecoAtribuicao = {
  id: string;
  nome: string;
  padrao: boolean;
  billingTabelaPrecoId: string | null;
};

export function toTabelaPrecoAtribuicao(t: CadastroTabelaComItens): TabelaPrecoAtribuicao {
  return {
    id: t.id,
    nome: t.nome,
    padrao: t.padrao,
    billingTabelaPrecoId: t.billingTabelaPrecoId,
  };
}

export function cadastroIdFromBilling(
  tabelas: TabelaPrecoAtribuicao[],
  billingTabelaPrecoId: string | null | undefined,
): string | null {
  if (billingTabelaPrecoId) {
    const hit = tabelas.find((t) => t.billingTabelaPrecoId === billingTabelaPrecoId);
    if (hit) return hit.id;
  }
  return tabelas.find((t) => t.padrao)?.id ?? tabelas[0]?.id ?? null;
}

/** Tabela realmente ligada ao billing do cliente — sem substituir pela padrão. */
export function cadastroIdAtribuido(
  tabelas: Array<{ id: string; billingTabelaPrecoId: string | null }>,
  billingTabelaPrecoId: string | null | undefined,
): string | null {
  if (!billingTabelaPrecoId) return null;
  return tabelas.find((t) => t.billingTabelaPrecoId === billingTabelaPrecoId)?.id ?? null;
}

export type CadastroTabelaItemMatch = CadastroTabelaPrecoItem;
