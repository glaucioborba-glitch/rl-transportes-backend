import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, Role, StatusSolicitacao } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  private assertRelatorios(actor: AuthUser) {
    if (actor.role !== Role.ADMIN && actor.role !== Role.GERENTE) {
      throw new ForbiddenException('Relatórios restritos a administradores e gerentes.');
    }
  }

  private assertPeriodoValido(ini: Date, fim: Date) {
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) {
      throw new BadRequestException('Datas do período inválidas ou incompletas.');
    }
    if (ini > fim) {
      throw new BadRequestException('dataInicio deve ser anterior ou igual a dataFim');
    }
  }

  async resumoSolicitacoes(dataInicio: string, dataFim: string, actor: AuthUser) {
    this.assertRelatorios(actor);
    const ini = new Date(dataInicio);
    const fim = new Date(dataFim);
    this.assertPeriodoValido(ini, fim);

    const rows = await this.prisma.solicitacao.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        createdAt: { gte: ini, lte: fim },
      },
      _count: { _all: true },
    });

    const porStatus = Object.values(StatusSolicitacao).map((st) => {
      const row = rows.find((r) => r.status === st);
      return { status: st, quantidade: row?._count._all ?? 0 };
    });

    const total = porStatus.reduce((a, b) => a + b.quantidade, 0);

    return {
      periodo: { dataInicio: ini.toISOString(), dataFim: fim.toISOString() },
      total,
      porStatus,
    };
  }

  async resumoFinanceiro(
    dataInicio: string,
    dataFim: string,
    actor: AuthUser,
    filtroClienteId?: string,
  ) {
    this.assertRelatorios(actor);
    const ini = new Date(dataInicio);
    const fim = new Date(dataFim);
    this.assertPeriodoValido(ini, fim);

    const whereFin: Prisma.FaturamentoWhereInput = {
      createdAt: { gte: ini, lte: fim },
      ...(filtroClienteId ? { clienteId: filtroClienteId } : {}),
    };

    const agg = await this.prisma.faturamento.aggregate({
      where: whereFin,
      _sum: { valorTotal: true },
      _count: { id: true },
    });

    const porCliente = await this.prisma.faturamento.groupBy({
      by: ['clienteId'],
      where: whereFin,
      _sum: { valorTotal: true },
      _count: { id: true },
    });

    const nomes = await this.prisma.cliente.findMany({
      where: { id: { in: porCliente.map((p) => p.clienteId) } },
      select: { id: true, nome: true },
    });
    const mapa = new Map(nomes.map((n) => [n.id, n.nome]));

    return {
      periodo: { dataInicio: ini.toISOString(), dataFim: fim.toISOString() },
      totalValor: agg._sum.valorTotal ?? new Prisma.Decimal(0),
      quantidadeFaturamentos: agg._count.id,
      porCliente: porCliente.map((p) => ({
        clienteId: p.clienteId,
        nome: mapa.get(p.clienteId) ?? '',
        valor: p._sum.valorTotal ?? new Prisma.Decimal(0),
        quantidade: p._count.id,
      })),
    };
  }

  async listaSolicitacoes(q: {
    dataInicio: string;
    dataFim: string;
    page: number;
    limit: number;
    clienteId?: string;
    status?: StatusSolicitacao;
  }, actor: AuthUser) {
    this.assertRelatorios(actor);
    const ini = new Date(q.dataInicio);
    const fim = new Date(q.dataFim);
    this.assertPeriodoValido(ini, fim);
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.SolicitacaoWhereInput = {
      deletedAt: null,
      createdAt: { gte: ini, lte: fim },
      ...(q.clienteId ? { clienteId: q.clienteId } : {}),
      ...(q.status ? { status: q.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.solicitacao.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          protocolo: true,
          status: true,
          createdAt: true,
          clienteId: true,
          cliente: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.solicitacao.count({ where }),
    ]);

    return {
      periodo: { dataInicio: ini.toISOString(), dataFim: fim.toISOString() },
      items,
      meta: { total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
    };
  }

  async listaFaturamentos(q: {
    dataInicio: string;
    dataFim: string;
    page: number;
    limit: number;
    clienteId?: string;
  }, actor: AuthUser) {
    this.assertRelatorios(actor);
    const ini = new Date(q.dataInicio);
    const fim = new Date(q.dataFim);
    this.assertPeriodoValido(ini, fim);
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.FaturamentoWhereInput = {
      createdAt: { gte: ini, lte: fim },
      ...(q.clienteId ? { clienteId: q.clienteId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.faturamento.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cliente: { select: { id: true, nome: true } },
          _count: { select: { nfsEmitidas: true, boletos: true, solicitacoesVinculadas: true } },
        },
      }),
      this.prisma.faturamento.count({ where }),
    ]);

    return {
      periodo: { dataInicio: ini.toISOString(), dataFim: fim.toISOString() },
      items,
      meta: { total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
    };
  }
}
