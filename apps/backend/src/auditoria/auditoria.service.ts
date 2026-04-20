import { Injectable, Logger } from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditoriaQueryDto } from './dto/auditoria-query.dto';

export interface AuditoriaParams {
  tabela: string;
  registroId: string;
  acao: AcaoAuditoria;
  /** Deve ser o UUID do usuário autenticado (FK em `auditorias.usuario`). */
  usuario: string;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  ip?: string;
  userAgent?: string;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function withRequestContext(
  payload: unknown,
  ip?: string,
  userAgent?: string,
): Prisma.InputJsonValue {
  const record = toInputJson(payload);
  if (!ip && !userAgent) return record;
  return {
    record,
    request: { ip: ip ?? null, userAgent: userAgent ?? null },
  };
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Registra auditoria. Use `tx` quando estiver dentro de `prisma.$transaction`.
   */
  async registrar(params: AuditoriaParams, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const { tabela, registroId, acao, usuario, dadosAntes, dadosDepois, ip, userAgent } = params;

    const data: Prisma.AuditoriaUncheckedCreateInput = {
      tabela,
      registroId,
      acao,
      usuario,
    };

    if (dadosAntes !== undefined && dadosAntes !== null) {
      data.dadosAntes = withRequestContext(dadosAntes, ip, userAgent);
    }

    if (dadosDepois !== undefined && dadosDepois !== null) {
      data.dadosDepois = withRequestContext(dadosDepois, ip, userAgent);
    }

    try {
      return await db.auditoria.create({ data });
    } catch (error) {
      this.logger.error(`Erro ao registrar auditoria em ${tabela}`, error as Error);
      throw error;
    }
  }

  async buscarPorRegistro(tabela: string, registroId: string) {
    return this.prisma.auditoria.findMany({
      where: { tabela, registroId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async buscarPorUsuario(userId: string, limite: number = 100) {
    return this.prisma.auditoria.findMany({
      where: { usuario: userId },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });
  }

  async buscarComFiltros(query: AuditoriaQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const order: Prisma.SortOrder = query.order === 'asc' ? 'asc' : 'desc';

    const where: Prisma.AuditoriaWhereInput = {};
    if (query.tabela) where.tabela = query.tabela;
    if (query.registroId) where.registroId = query.registroId;
    if (query.usuario) where.usuario = query.usuario;
    if (query.acao) where.acao = query.acao;

    if (query.dataInicio || query.dataFim) {
      where.createdAt = {};
      if (query.dataInicio) {
        where.createdAt.gte = new Date(query.dataInicio);
      }
      if (query.dataFim) {
        where.createdAt.lte = new Date(query.dataFim);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: { total, page, limit, totalPages },
    };
  }

  async buscarPorPeriodo(dataInicio: Date, dataFim: Date) {
    return this.prisma.auditoria.findMany({
      where: {
        createdAt: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
