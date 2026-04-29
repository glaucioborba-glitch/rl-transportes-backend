import { Injectable } from '@nestjs/common';
import { Prisma, StatusSolicitacao, StatusPagamento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Agregações read-only para API Gateway v1 (ADMIN/GERENTE). */
@Injectable()
export class IntegracaoApiGatewayService {
  constructor(private readonly prisma: PrismaService) {}

  async operacionalResumo() {
    try {
      const [pendente, aprovado, concluido, rejeitado] = await Promise.all([
        this.prisma.solicitacao.count({
          where: { deletedAt: null, status: StatusSolicitacao.PENDENTE },
        }),
        this.prisma.solicitacao.count({
          where: { deletedAt: null, status: StatusSolicitacao.APROVADO },
        }),
        this.prisma.solicitacao.count({
          where: { deletedAt: null, status: StatusSolicitacao.CONCLUIDO },
        }),
        this.prisma.solicitacao.count({
          where: { deletedAt: null, status: StatusSolicitacao.REJEITADO },
        }),
      ]);
      return {
        solicitacoesPorStatus: { pendente, aprovado, concluido, rejeitado },
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022')
        return { solicitacoesPorStatus: null, observacao: 'schema_desatualizado' };
      throw e;
    }
  }

  async financeiroResumo() {
    try {
      const [fatCount, boletoAberto] = await Promise.all([
        this.prisma.faturamento.count(),
        this.prisma.boleto.count({
          where: { statusPagamento: { in: [StatusPagamento.PENDENTE, StatusPagamento.VENCIDO] } },
        }),
      ]);
      return { faturamentosRegistrados: fatCount, boletosPendentesOuVencidos: boletoAberto };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022')
        return { faturamentosRegistrados: null, boletosPendentesOuVencidos: null, observacao: 'schema_desatualizado' };
      throw e;
    }
  }

  async fiscalResumo() {
    try {
      const nfs = await this.prisma.nfsEmitida.count();
      return { nfsEmitidasTotal: nfs };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022')
        return { nfsEmitidasTotal: null, observacao: 'schema_desatualizado' };
      throw e;
    }
  }

  async clienteCatalogoCount() {
    try {
      const ativos = await this.prisma.cliente.count({ where: { deletedAt: null } });
      return { clientesAtivos: ativos };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022')
        return { clientesAtivos: null, observacao: 'schema_desatualizado' };
      throw e;
    }
  }
}
