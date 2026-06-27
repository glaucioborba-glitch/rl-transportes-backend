import { Injectable } from '@nestjs/common';
import { CategoriaAuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditTrailQueryDto } from './dto/audit-trail-query.dto';

export type AuditTrailUiItem = {
  id: string;
  criadoEm: string;
  categoria: CategoriaAuditLog;
  acao: string;
  containerIso: string | null;
  descricaoNarrativa: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  ipAddress: string | null;
  dadosAnteriores: unknown;
  dadosNovos: unknown;
};

@Injectable()
export class AuditTrailService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(tenantId: string, query: AuditTrailQueryDto): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = { tenantId };

    if (query.categoria) where.categoria = query.categoria;
    if (query.usuarioId) where.usuarioId = query.usuarioId;
    if (query.acao) where.acao = query.acao;
    if (query.containerIso) {
      where.containerIso = { contains: query.containerIso.replace(/\s/g, ''), mode: 'insensitive' };
    }

    if (query.dataInicio || query.dataFim) {
      where.criadoEm = {};
      if (query.dataInicio) where.criadoEm.gte = new Date(query.dataInicio);
      if (query.dataFim) {
        const fim = new Date(query.dataFim);
        fim.setHours(23, 59, 59, 999);
        where.criadoEm.lte = fim;
      }
    }

    const q = query.q?.trim();
    if (q) {
      const protocoloMatch: Prisma.AuditLogWhereInput[] = [
        { containerIso: { contains: q.replace(/\s/g, ''), mode: 'insensitive' } },
        { usuarioNome: { contains: q, mode: 'insensitive' } },
        { descricaoNarrativa: { contains: q, mode: 'insensitive' } },
        { acao: { contains: q.replace(/\s/g, '_').toUpperCase(), mode: 'insensitive' } },
      ];
      if (/^RL-/i.test(q)) {
        protocoloMatch.push({ descricaoNarrativa: { contains: q, mode: 'insensitive' } });
      }
      where.OR = protocoloMatch;
    }

    return where;
  }

  async list(tenantId: string, query: AuditTrailQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 30, 100);
    const skip = (page - 1) * limit;
    const where = this.buildWhere(tenantId, query);

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toUi(r)),
      meta: { total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
    };
  }

  async listUsuarios(tenantId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId },
      distinct: ['usuarioId'],
      select: { usuarioId: true, usuarioNome: true },
      orderBy: { usuarioNome: 'asc' },
      take: 200,
    });
    return rows;
  }

  async listAcoes(tenantId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId },
      distinct: ['acao'],
      select: { acao: true },
      orderBy: { acao: 'asc' },
      take: 100,
    });
    return rows.map((r) => r.acao);
  }

  buildCsv(items: AuditTrailUiItem[]): string {
    const header = [
      'Data/Hora',
      'Categoria',
      'Ação',
      'Contêiner',
      'Descrição',
      'Usuário',
      'IP',
    ];
    const lines = items.map((i) =>
      [
        i.criadoEm,
        i.categoria,
        i.acao,
        i.containerIso ?? '',
        i.descricaoNarrativa.replace(/"/g, '""'),
        i.usuarioNome,
        i.ipAddress ?? '',
      ]
        .map((c) => `"${c}"`)
        .join(','),
    );
    return `\uFEFF${header.join(',')}\n${lines.join('\n')}`;
  }

  async export(tenantId: string, query: AuditTrailQueryDto) {
    const where = this.buildWhere(tenantId, query);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 5000,
    });
    return rows.map((r) => this.toUi(r));
  }

  private toUi(r: {
    id: string;
    criadoEm: Date;
    categoria: CategoriaAuditLog;
    acao: string;
    containerIso: string | null;
    descricaoNarrativa: string;
    usuarioId: string;
    usuarioNome: string;
    usuarioRole: string;
    ipAddress: string | null;
    dadosAnteriores: unknown;
    dadosNovos: unknown;
  }): AuditTrailUiItem {
    return {
      id: r.id,
      criadoEm: r.criadoEm.toISOString(),
      categoria: r.categoria,
      acao: r.acao,
      containerIso: r.containerIso,
      descricaoNarrativa: r.descricaoNarrativa,
      usuarioId: r.usuarioId,
      usuarioNome: r.usuarioNome,
      usuarioRole: r.usuarioRole,
      ipAddress: r.ipAddress,
      dadosAnteriores: r.dadosAnteriores,
      dadosNovos: r.dadosNovos,
    };
  }
}
