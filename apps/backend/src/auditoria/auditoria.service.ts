import { Injectable, Logger } from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
      where: { usuario: { contains: userId } },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });
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
