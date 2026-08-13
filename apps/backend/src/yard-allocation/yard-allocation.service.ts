import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventoGatilhoTarifa, GiroEstimado, Prisma, TipoOperacaoSolicitacaoIntent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MS_PER_DAY = 86_400_000;
const DEFAULT_FREE_TIME_DIAS = 7;

/** Classifica dias até retirada/deadline em giro operacional. */
export function classifyGiroEstimado(dias: number): GiroEstimado {
  const d = Math.max(0, Math.ceil(dias));
  if (d <= 3) return GiroEstimado.RAPIDO;
  if (d <= 7) return GiroEstimado.MEDIO;
  return GiroEstimado.LENTO;
}

export function parseOptionalDateTime(raw?: string | null): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Data/hora inválida');
  }
  return d;
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class YardAllocationService {
  private readonly logger = new Logger(YardAllocationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Dias até a data-alvo; se ausente, usa free time da tarifária como teto. */
  computeDiasPermanencia(input: {
    previsaoRetirada: Date | null;
    bookingDeadline: Date | null;
    freeTimeDias: number;
    referenceAt?: Date;
  }): number {
    const ref = startOfDayUtc(input.referenceAt ?? new Date());
    const target = input.bookingDeadline ?? input.previsaoRetirada;

    if (target) {
      const targetDay = startOfDayUtc(target);
      return Math.max(0, Math.ceil((targetDay.getTime() - ref.getTime()) / MS_PER_DAY));
    }

    return Math.max(1, input.freeTimeDias || DEFAULT_FREE_TIME_DIAS);
  }

  async resolveFreeTimeDias(clienteId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const db = tx ?? this.prisma;

    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: {
        tenantId: true,
        tabelaPreco: {
          include: {
            regras: {
              where: { ativa: true, eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM },
              take: 1,
            },
          },
        },
      },
    });

    if (cliente?.tabelaPreco?.regras[0]) {
      return cliente.tabelaPreco.regras[0].diasFreeTime;
    }

    const padrao = await db.tabelaPreco.findFirst({
      where: { tenantId: cliente?.tenantId ?? 'default', padrao: true, ativa: true },
      include: {
        regras: {
          where: { ativa: true, eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM },
          take: 1,
        },
      },
    });

    return padrao?.regras[0]?.diasFreeTime ?? DEFAULT_FREE_TIME_DIAS;
  }

  async applyGiroEstimado(
    solicitacaoId: string,
    opts?: { referenceAt?: Date; tx?: Prisma.TransactionClient },
  ): Promise<GiroEstimado | null> {
    const db = opts?.tx ?? this.prisma;
    const sol = await db.solicitacao.findFirst({
      where: { id: solicitacaoId, deletedAt: null },
      select: {
        id: true,
        clienteId: true,
        previsaoRetirada: true,
        bookingDeadline: true,
        tipoOperacao: true,
      },
    });
    if (!sol) return null;

    if (
      sol.tipoOperacao !== TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA &&
      sol.tipoOperacao !== TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT &&
      sol.tipoOperacao !== TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT
    ) {
      return null;
    }

    const freeTimeDias = await this.resolveFreeTimeDias(sol.clienteId, db);
    const dias = this.computeDiasPermanencia({
      previsaoRetirada: sol.previsaoRetirada,
      bookingDeadline: sol.bookingDeadline,
      freeTimeDias,
      referenceAt: opts?.referenceAt,
    });
    const giro = classifyGiroEstimado(dias);

    await db.solicitacao.update({
      where: { id: sol.id },
      data: { giroEstimado: giro },
    });

    this.logger.log(
      `Giro ${giro} aplicado — solicitação ${sol.id} (${dias} dia(s) estimados)`,
    );
    return giro;
  }
}
