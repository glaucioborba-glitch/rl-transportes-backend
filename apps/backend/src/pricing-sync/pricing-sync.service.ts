import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  isArmazenagemItem,
  mapArmazenagemItemToRegras,
  type CadastroArmazenagemItem,
} from './pricing-sync.mapper';

const DEFAULT_TENANT = 'default';

@Injectable()
export class PricingSyncService {
  private readonly logger = new Logger(PricingSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async syncFromCadastro(cadastroTabelaId: string, actorUserId?: string) {
    const cadastro = await this.prisma.cadastroTabelaPreco.findUnique({
      where: { id: cadastroTabelaId },
      include: { itens: true },
    });
    if (!cadastro || cadastro.deletedAt) {
      throw new BadRequestException('Tabela cadastral não encontrada.');
    }

    const armazenagemItens = cadastro.itens.filter(isArmazenagemItem) as CadastroArmazenagemItem[];
    if (!armazenagemItens.length) {
      this.logger.warn(`Tabela ${cadastroTabelaId} sem itens ARMAZENAGEM — sync parcial.`);
    }

    const regrasPayload = armazenagemItens.flatMap((item) =>
      mapArmazenagemItemToRegras(item, 'PLACEHOLDER'),
    );

    const billingId = await this.prisma.$transaction(async (tx) => {
      let billing = cadastro.billingTabelaPrecoId
        ? await tx.tabelaPreco.findUnique({ where: { id: cadastro.billingTabelaPrecoId } })
        : null;

      if (!billing) {
        billing = await tx.tabelaPreco.create({
          data: {
            tenantId: cadastro.tenantId ?? DEFAULT_TENANT,
            nome: cadastro.nome,
            ativa: cadastro.ativo,
            padrao: cadastro.padrao,
          },
        });
      } else {
        await tx.tabelaPreco.update({
          where: { id: billing.id },
          data: {
            nome: cadastro.nome,
            ativa: cadastro.ativo,
            padrao: cadastro.padrao,
          },
        });
      }

      if (cadastro.padrao) {
        await tx.tabelaPreco.updateMany({
          where: {
            tenantId: billing.tenantId,
            padrao: true,
            NOT: { id: billing.id },
          },
          data: { padrao: false },
        });
        await tx.cadastroTabelaPreco.updateMany({
          where: {
            tenantId: cadastro.tenantId,
            padrao: true,
            NOT: { id: cadastro.id },
          },
          data: { padrao: false },
        });
      }

      await tx.regraTarifaria.deleteMany({ where: { tabelaPrecoId: billing.id } });

      if (regrasPayload.length) {
        await tx.regraTarifaria.createMany({
          data: regrasPayload.map((r) => ({ ...r, tabelaPrecoId: billing!.id })),
        });
      }

      await tx.cadastroTabelaPreco.update({
        where: { id: cadastro.id },
        data: {
          billingTabelaPrecoId: billing.id,
          syncedAt: new Date(),
        },
      });

      return billing.id;
    });

    if (actorUserId) {
      await this.auditoria.registrar({
        tabela: 'cadastros_tabelas_preco',
        registroId: cadastro.id,
        acao: AcaoAuditoria.UPDATE,
        usuario: actorUserId,
        dadosDepois: { syncBillingTabelaPrecoId: billingId, regras: regrasPayload.length },
      });
    }

    return { billingTabelaPrecoId: billingId, regrasCount: regrasPayload.length };
  }

  async ensureDefaultTableSynced(tenantId = DEFAULT_TENANT) {
    const padrao = await this.prisma.cadastroTabelaPreco.findFirst({
      where: { tenantId, padrao: true, deletedAt: null, ativo: true },
    });
    if (!padrao) return null;
    if (padrao.billingTabelaPrecoId && padrao.syncedAt) return padrao.billingTabelaPrecoId;
    const result = await this.syncFromCadastro(padrao.id);
    return result.billingTabelaPrecoId;
  }
}
