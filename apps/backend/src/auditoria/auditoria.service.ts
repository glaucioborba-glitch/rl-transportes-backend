import { Injectable } from '@nestjs/common';
import { AcaoAuditoria, Auditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

const MAX_JSON_BYTES = 10 * 1024 * 1024;

function truncateForAudit(data: unknown): Prisma.InputJsonValue | undefined {
  if (data === undefined) return undefined;
  const s = JSON.stringify(data);
  if (s.length <= MAX_JSON_BYTES) {
    return data as Prisma.InputJsonValue;
  }
  return {
    _truncado: true,
    tamanhoBytes: s.length,
    amostra: s.slice(0, 4096),
  } as Prisma.InputJsonValue;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra auditoria na mesma transação do Prisma (atomicidade com a operação de negócio).
   */
  async registrar(
    ctx: PrismaService | Tx,
    input: {
      tabela: string;
      registroId: string;
      acao: AcaoAuditoria;
      userId: string;
      dadosAntes?: unknown;
      dadosDepois?: unknown;
    },
  ) {
    const data: Prisma.AuditoriaCreateInput = {
      tabela: input.tabela,
      registroId: input.registroId,
      acao: input.acao,
      user: { connect: { id: input.userId } },
    };
    if (input.dadosAntes !== undefined) {
      data.dadosAntes = truncateForAudit(input.dadosAntes);
    }
    if (input.dadosDepois !== undefined) {
      data.dadosDepois = truncateForAudit(input.dadosDepois);
    }
    return ctx.auditoria.create({ data });
  }

  async buscarPorRegistro(tabela: string, registroId: string): Promise<Auditoria[]> {
    return this.prisma.auditoria.findMany({
      where: { tabela, registroId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async buscarPorUsuario(usuario: string, limite = 100): Promise<Auditoria[]> {
    return this.prisma.auditoria.findMany({
      where: { userId: usuario },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limite, 500),
    });
  }

  async buscarPorPeriodo(
    dataInicio: Date,
    dataFim: Date,
    tabela?: string,
  ): Promise<Auditoria[]> {
    return this.prisma.auditoria.findMany({
      where: {
        createdAt: { gte: dataInicio, lte: dataFim },
        ...(tabela ? { tabela } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
