/**
 * Sincroniza tabela cadastral → TabelaPreco + RegraTarifaria (uso em seeds/scripts).
 */
import { PrismaClient } from '@prisma/client';
import {
  isArmazenagemItem,
  mapArmazenagemItemToRegras,
  type CadastroArmazenagemItem,
} from '../src/pricing-sync/pricing-sync.mapper';
import {
  ensureCadastroTabelaPadrao,
  purgeOrphanBillingTables,
} from '../src/pricing-sync/purge-orphan-billing-tables';

export async function syncCadastroTabelaToBilling(
  prisma: PrismaClient,
  cadastroTabelaId: string,
): Promise<string> {
  const cadastro = await prisma.cadastroTabelaPreco.findUnique({
    where: { id: cadastroTabelaId },
    include: { itens: true },
  });
  if (!cadastro) throw new Error(`Cadastro tabela ${cadastroTabelaId} não encontrada.`);

  const armazenagemItens = cadastro.itens.filter(isArmazenagemItem) as CadastroArmazenagemItem[];
  const regrasPayload = armazenagemItens.flatMap((item) =>
    mapArmazenagemItemToRegras(item, 'PLACEHOLDER'),
  );

  let billingId = cadastro.billingTabelaPrecoId;
  if (billingId) {
    await prisma.tabelaPreco.update({
      where: { id: billingId },
      data: { nome: cadastro.nome, ativa: cadastro.ativo, padrao: cadastro.padrao },
    });
  } else {
    const billing = await prisma.tabelaPreco.create({
      data: {
        tenantId: cadastro.tenantId,
        nome: cadastro.nome,
        ativa: cadastro.ativo,
        padrao: cadastro.padrao,
      },
    });
    billingId = billing.id;
  }

  if (cadastro.padrao) {
    await prisma.tabelaPreco.updateMany({
      where: { tenantId: cadastro.tenantId, padrao: true, NOT: { id: billingId } },
      data: { padrao: false },
    });
    await prisma.cadastroTabelaPreco.updateMany({
      where: { tenantId: cadastro.tenantId, padrao: true, NOT: { id: cadastro.id } },
      data: { padrao: false },
    });
  }

  await prisma.regraTarifaria.deleteMany({ where: { tabelaPrecoId: billingId } });
  if (regrasPayload.length) {
    await prisma.regraTarifaria.createMany({
      data: regrasPayload.map((r) => ({ ...r, tabelaPrecoId: billingId! })),
    });
  }

  await prisma.cadastroTabelaPreco.update({
    where: { id: cadastro.id },
    data: { billingTabelaPrecoId: billingId, syncedAt: new Date() },
  });

  return billingId;
}

export async function ensureDefaultPricingSynced(prisma: PrismaClient, tenantId = 'default') {
  await ensureCadastroTabelaPadrao(prisma, tenantId);
  const padrao = await prisma.cadastroTabelaPreco.findFirst({
    where: { tenantId, padrao: true, deletedAt: null, ativo: true },
  });
  if (!padrao) {
    console.warn('[pricing-sync-seed] Nenhuma tabela cadastral padrão encontrada.');
    return null;
  }
  const billingId = await syncCadastroTabelaToBilling(prisma, padrao.id);
  const purged = await purgeOrphanBillingTables(prisma, tenantId);
  if (purged.deleted.length) {
    console.log(
      `[pricing-sync-seed] Removidas tabelas de billing sem cadastro: ${purged.deleted.map((t) => t.nome).join(', ')}`,
    );
  }
  console.log(`[pricing-sync-seed] Tabela padrão sincronizada → billing ${billingId}`);
  return billingId;
}
