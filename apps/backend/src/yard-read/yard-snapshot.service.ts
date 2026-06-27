import { Injectable, Logger } from '@nestjs/common';
import { PatioStatus, StatusSolicitacao, TipoContainerTos } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RealtimeEmitterService } from '../realtime/realtime-emitter.service';
import {
  yardSnapshotRedisKey,
  type YardContainerSnapshot,
  type YardPilhaSnapshot,
  type YardSnapshotResponse,
} from './yard-snapshot.types';

const SNAPSHOT_TTL_SEC = 86_400;

@Injectable()
export class YardSnapshotService {
  private readonly logger = new Logger(YardSnapshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeEmitterService,
  ) {}

  /** Leitura O(1) — Redis first, fallback rebuild. */
  async getSnapshotForCliente(clienteId: string): Promise<YardSnapshotResponse> {
    const cached = await this.redis.get(yardSnapshotRedisKey(clienteId));
    if (cached) {
      try {
        return JSON.parse(cached) as YardSnapshotResponse;
      } catch {
        this.logger.warn(`Snapshot Redis inválido para ${clienteId}`);
      }
    }
    return this.rebuildAndCache(clienteId);
  }

  async rebuildAndCache(clienteId: string): Promise<YardSnapshotResponse> {
    const snapshot = await this.buildFromDatabase(clienteId);
    await this.redis.setex(yardSnapshotRedisKey(clienteId), SNAPSHOT_TTL_SEC, JSON.stringify(snapshot));
    this.realtime.emitYardUpdated({
      clienteId,
      atualizadoEm: snapshot.atualizadoEm,
      pilhasCount: snapshot.pilhas.length,
    });
    return snapshot;
  }

  async onYardMutation(clienteIds: string[]): Promise<void> {
    const unique = [...new Set(clienteIds.filter(Boolean))];
    await Promise.all(unique.map((id) => this.rebuildAndCache(id)));
  }

  private async buildFromDatabase(clienteId: string): Promise<YardSnapshotResponse> {
    const unidades = await this.prisma.patioUnidade.findMany({
      where: {
        posicaoAtualId: { not: null },
        status: { in: [PatioStatus.ESTOCADO, PatioStatus.MOVIMENTANDO] },
        solicitacao: {
          clienteId,
          status: { in: [StatusSolicitacao.EM_PATIO, StatusSolicitacao.AGUARDANDO_GATE_OUT] },
        },
      },
      include: {
        posicaoAtual: { select: { id: true, codigoBaia: true } },
        solicitacao: {
          select: {
            cliente: { select: { razaoSocial: true, nomeFantasia: true } },
            containersSolicitacao: { select: { unidade: true, refrigerado: true, booking: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byBaia = new Map<string, typeof unidades>();
    for (const u of unidades) {
      const codigo = u.posicaoAtual?.codigoBaia ?? 'SEM-BAIA';
      const list = byBaia.get(codigo) ?? [];
      list.push(u);
      byBaia.set(codigo, list);
    }

    const pilhas: YardPilhaSnapshot[] = [];
    for (const [codigo, list] of byBaia.entries()) {
      const sorted = [...list].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const containers: YardContainerSnapshot[] = sorted.map((u, idx) => ({
        id: u.id,
        numero: u.unidadeIso,
        tipo: mapTipo(u.refrigerado),
        clienteFinal:
          u.solicitacao.containersSolicitacao[0]?.booking ??
          u.solicitacao.cliente?.nomeFantasia ??
          u.solicitacao.cliente?.razaoSocial ??
          '—',
        posicaoNaPilha: idx + 1,
      }));
      pilhas.push({
        id: `pilha-${codigo}`,
        codigo,
        containers,
      });
    }

    pilhas.sort((a, b) => a.codigo.localeCompare(b.codigo));

    return {
      pilhas,
      atualizadoEm: new Date().toISOString(),
    };
  }
}

function mapTipo(refrigerado: boolean): YardContainerSnapshot['tipo'] {
  return refrigerado ? 'REEFER' : 'DRY';
}
