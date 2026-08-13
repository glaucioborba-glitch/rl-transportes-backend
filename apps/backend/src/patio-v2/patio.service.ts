import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcaoAuditoria,
  MovTipo,
  PatioStatus,
  PatioTomadaEventType,
  Prisma,
  StatusSolicitacao,
} from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { withOcc } from '../common/prisma/occ.util';
import { normalizeContainerIso } from '../common/utils/data-sanitize';
import { SecurityEventsService } from '../security-center/security-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { YardSnapshotService } from '../yard-read/yard-snapshot.service';
import type { PatioMovimentarDto } from './dto/movimentar.dto';
import type { PatioPosicionarDto } from './dto/posicionar.dto';
import type {
  PatioTomadaConectarDto,
  PatioTomadaDesconectarDto,
  PortalSolicitarTomadaDto,
} from './dto/tomada.dto';

const OCUPACAO_CRITICA_RATIO = 1;

@Injectable()
export class PatioV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly securityEvents: SecurityEventsService,
    private readonly yardSnapshot: YardSnapshotService,
  ) {}

  /** Após Gate Check-In: uma PatioUnidade por container da solicitação (status SEPARADO). */
  async provisionFromGateIn(
    gateInId: string,
    solicitacaoId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = tx ?? this.prisma;
    const existing = await db.patioUnidade.count({ where: { gateInId } });
    if (existing > 0) return existing;

    const containers = await db.containerSolicitacao.findMany({
      where: { solicitacaoId },
      orderBy: { ordem: 'asc' },
    });

    let created = 0;
    for (const c of containers) {
      const iso = normalizeContainerIso(c.unidade).replace(/\s/g, '').toUpperCase();
      const unit = await db.patioUnidade.create({
        data: {
          unidadeIso: iso,
          solicitacaoId,
          gateInId,
          status: PatioStatus.SEPARADO,
          refrigerado: c.refrigerado,
        },
      });
      if (c.refrigerado) {
        await db.patioTomadaEvent.create({
          data: {
            patioUnidadeId: unit.id,
            tipo: PatioTomadaEventType.CONECTADO,
            setPoint: c.setPoint ?? null,
            observacao: 'Conexão solicitada na baixa (gate-in)',
          },
        });
      }
      created++;
    }
    return created;
  }

  async solicitarTomadaPortal(
    clienteId: string,
    unidadeIsoRaw: string,
    dto: PortalSolicitarTomadaDto,
    actorUserId?: string,
  ) {
    const unidadeIso = normalizeContainerIso(unidadeIsoRaw).replace(/\s/g, '').toUpperCase();
    const unit = await this.prisma.patioUnidade.findFirst({
      where: {
        unidadeIso,
        solicitacao: { clienteId, deletedAt: null },
        gateIn: { checkOut: null },
        status: { not: PatioStatus.AGUARDANDO_GATE_OUT },
      },
      include: {
        tomadaEventos: { orderBy: { createdAt: 'desc' }, take: 5 },
        solicitacao: {
          include: {
            containersSolicitacao: true,
          },
        },
      },
    });
    if (!unit) {
      throw new NotFoundException('Contêiner não encontrado no pátio ou já liberado.');
    }
    if (unit.refrigerado) {
      throw new BadRequestException('Tomada já está conectada para este contêiner.');
    }
    const pending = unit.tomadaEventos.find((e) => e.tipo === PatioTomadaEventType.SOLICITADO);
    const last = unit.tomadaEventos[0];
    if (pending && last?.tipo === PatioTomadaEventType.SOLICITADO) {
      throw new BadRequestException('Já existe solicitação de tomada pendente para este contêiner.');
    }

    const form = unit.solicitacao.containersSolicitacao.find(
      (c) => normalizeContainerIso(c.unidade).replace(/\s/g, '').toUpperCase() === unidadeIso,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.patioTomadaEvent.create({
        data: {
          patioUnidadeId: unit.id,
          tipo: PatioTomadaEventType.SOLICITADO,
          setPoint: dto.setPoint,
          actorUserId: actorUserId ?? null,
          observacao: dto.observacao?.trim() || 'Solicitação do cliente (portal)',
        },
      });
      if (form) {
        await tx.containerSolicitacao.update({
          where: { id: form.id },
          data: { refrigerado: true, setPoint: dto.setPoint },
        });
      }
    });

    await this.auditoria.registrar({
      tabela: 'patio_v2_tomada_eventos',
      registroId: unit.id,
      acao: AcaoAuditoria.INSERT,
      usuario: actorUserId ?? 'portal',
      solicitacaoId: unit.solicitacaoId,
      dadosDepois: { tipo: 'SOLICITADO', unidadeIso, setPoint: dto.setPoint },
    });

    return {
      unidadeIso,
      status: 'SOLICITADO',
      setPoint: dto.setPoint,
      message: 'Pedido de tomada registrado. A operação conectará a unidade no pátio.',
    };
  }

  async conectarTomada(unidadeId: string, operadorId: string, dto: PatioTomadaConectarDto) {
    const unit = await this.prisma.patioUnidade.findUnique({
      where: { id: unidadeId },
      include: {
        solicitacao: { include: { containersSolicitacao: true } },
      },
    });
    if (!unit) throw new NotFoundException('Unidade de pátio não encontrada');
    if (unit.refrigerado) {
      throw new BadRequestException('Tomada já conectada.');
    }

    const iso = unit.unidadeIso;
    const form = unit.solicitacao.containersSolicitacao.find(
      (c) => normalizeContainerIso(c.unidade).replace(/\s/g, '').toUpperCase() === iso,
    );
    const setPoint = dto.setPoint ?? form?.setPoint ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.patioUnidade.update({
        where: { id: unit.id },
        data: { refrigerado: true },
      });
      await tx.patioTomadaEvent.create({
        data: {
          patioUnidadeId: unit.id,
          tipo: PatioTomadaEventType.CONECTADO,
          setPoint,
          actorUserId: operadorId,
          observacao: dto.observacao?.trim() || null,
        },
      });
      if (form) {
        await tx.containerSolicitacao.update({
          where: { id: form.id },
          data: {
            refrigerado: true,
            ...(setPoint != null ? { setPoint } : {}),
          },
        });
      }
    });

    await this.auditoria.registrar({
      tabela: 'patio_v2_tomada_eventos',
      registroId: unit.id,
      acao: AcaoAuditoria.UPDATE,
      usuario: operadorId,
      solicitacaoId: unit.solicitacaoId,
      dadosDepois: { tipo: 'CONECTADO', unidadeIso: iso, setPoint },
    });

    return { id: unit.id, unidadeIso: iso, refrigerado: true, setPoint };
  }

  async desconectarTomada(unidadeId: string, operadorId: string, dto: PatioTomadaDesconectarDto) {
    const unit = await this.prisma.patioUnidade.findUnique({ where: { id: unidadeId } });
    if (!unit) throw new NotFoundException('Unidade de pátio não encontrada');
    if (!unit.refrigerado) {
      throw new BadRequestException('Tomada já está desconectada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.patioUnidade.update({
        where: { id: unit.id },
        data: { refrigerado: false },
      });
      await tx.patioTomadaEvent.create({
        data: {
          patioUnidadeId: unit.id,
          tipo: PatioTomadaEventType.DESCONECTADO,
          actorUserId: operadorId,
          observacao: dto.observacao?.trim() || null,
        },
      });
    });

    await this.auditoria.registrar({
      tabela: 'patio_v2_tomada_eventos',
      registroId: unit.id,
      acao: AcaoAuditoria.UPDATE,
      usuario: operadorId,
      solicitacaoId: unit.solicitacaoId,
      dadosDepois: { tipo: 'DESCONECTADO', unidadeIso: unit.unidadeIso },
    });

    return { id: unit.id, unidadeIso: unit.unidadeIso, refrigerado: false };
  }

  async statusTomada(unidadeIsoRaw: string, clienteId?: string) {
    const unidadeIso = normalizeContainerIso(unidadeIsoRaw).replace(/\s/g, '').toUpperCase();
    const unit = await this.prisma.patioUnidade.findFirst({
      where: {
        unidadeIso,
        ...(clienteId ? { solicitacao: { clienteId } } : {}),
        gateIn: { checkOut: null },
      },
      include: {
        tomadaEventos: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!unit) throw new NotFoundException('Contêiner não encontrado no pátio');
    let solicitacaoPendente = false;
    for (const e of unit.tomadaEventos) {
      if (e.tipo === PatioTomadaEventType.CONECTADO || e.tipo === PatioTomadaEventType.DESCONECTADO) {
        break;
      }
      if (e.tipo === PatioTomadaEventType.SOLICITADO) {
        solicitacaoPendente = !unit.refrigerado;
        break;
      }
    }
    return {
      unidadeId: unit.id,
      unidadeIso: unit.unidadeIso,
      conectada: unit.refrigerado,
      solicitacaoPendente,
      eventos: unit.tomadaEventos.map((e) => ({
        tipo: e.tipo,
        setPoint: e.setPoint,
        createdAt: e.createdAt.toISOString(),
        observacao: e.observacao,
      })),
    };
  }

  async posicionar(operadorId: string, dto: PatioPosicionarDto) {
    const unidade = await this.prisma.patioUnidade.findUnique({
      where: { id: dto.unidadeId },
      include: { posicaoAtual: true, solicitacao: { select: { clienteId: true } } },
    });
    if (!unidade) throw new NotFoundException('Unidade de pátio não encontrada');
    if (unidade.status === PatioStatus.AGUARDANDO_GATE_OUT) {
      throw new BadRequestException('Unidade aguardando gate-out — movimentação bloqueada.');
    }

    const destino = await this.resolveBaia(dto.codigoBaia);
    await this.assertCapacidade(destino.id, unidade.id);

    const tipo = dto.tipo === 'LIFT_ON' ? MovTipo.LIFT_ON : MovTipo.REPOSICIONAMENTO;
    const origemId = unidade.posicaoAtualId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await withOcc(() =>
        tx.patioUnidade.update({
          where: { id: unidade.id },
          data: {
            posicaoAtualId: destino.id,
            status: PatioStatus.ESTOCADO,
          },
        }),
      );
      await this.touchPilhaLogica(tx, unidade.solicitacao.clienteId, destino.codigoBaia, destino.id);
      const mov = await tx.patioMovimentacao.create({
        data: {
          unidadeId: u.id,
          operadorId,
          origemId,
          destinoId: destino.id,
          tipo,
          observacao: dto.observacao?.trim() ?? null,
        },
      });
      await this.auditoria.registrar(
        {
          tabela: 'patio_v2_movimentacoes',
          registroId: mov.id,
          acao: AcaoAuditoria.INSERT,
          usuario: operadorId,
          solicitacaoId: u.solicitacaoId,
          dadosDepois: {
            tipo: 'PATIO_POSICIONAMENTO',
            unidadeIso: u.unidadeIso,
            baia: destino.codigoBaia,
          },
        },
        tx,
      );
      return { u, mov };
    });

    this.emitPatio('PATIO_POSICIONAMENTO', operadorId, unidade.solicitacaoId, {
      unidadeIso: unidade.unidadeIso,
      baiaDestino: destino.codigoBaia,
    });
    await this.checkOcupacaoCritica(destino.id, operadorId);
    void this.yardSnapshot.onYardMutation([unidade.solicitacao.clienteId]);

    return updated.u;
  }

  async movimentar(operadorId: string, dto: PatioMovimentarDto) {
    const unidade = await this.prisma.patioUnidade.findUnique({
      where: { id: dto.unidadeId },
      include: { posicaoAtual: true, solicitacao: { select: { clienteId: true } } },
    });
    if (!unidade) throw new NotFoundException('Unidade de pátio não encontrada');

    let origemId = unidade.posicaoAtualId;
    if (dto.codigoBaiaOrigem) {
      const o = await this.resolveBaia(dto.codigoBaiaOrigem);
      origemId = o.id;
    }

    let destinoId: string | null = null;
    if (dto.codigoBaiaDestino) {
      const d = await this.resolveBaia(dto.codigoBaiaDestino);
      await this.assertCapacidade(d.id, unidade.id);
      destinoId = d.id;
    }

    if (dto.tipo === MovTipo.LIFT_OFF) {
      destinoId = null;
    }

    const nextStatus =
      dto.tipo === MovTipo.LIFT_OFF
        ? PatioStatus.SEPARADO
        : dto.tipo === MovTipo.SHIFT || dto.tipo === MovTipo.REPOSICIONAMENTO
          ? PatioStatus.ESTOCADO
          : destinoId
            ? PatioStatus.ESTOCADO
            : PatioStatus.MOVIMENTANDO;

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await withOcc(() =>
        tx.patioUnidade.update({
          where: { id: unidade.id },
          data: {
            posicaoAtualId: destinoId,
            status: nextStatus,
          },
        }),
      );
      if (destinoId && dto.codigoBaiaDestino) {
        const dest = await tx.patioPosicao.findUnique({ where: { id: destinoId } });
        if (dest) {
          await this.touchPilhaLogica(tx, unidade.solicitacao.clienteId, dest.codigoBaia, dest.id);
        }
      }
      const mov = await tx.patioMovimentacao.create({
        data: {
          unidadeId: u.id,
          operadorId,
          origemId,
          destinoId,
          tipo: dto.tipo,
          observacao: dto.observacao?.trim() ?? null,
        },
      });
      await this.auditoria.registrar(
        {
          tabela: 'patio_v2_movimentacoes',
          registroId: mov.id,
          acao: AcaoAuditoria.INSERT,
          usuario: operadorId,
          solicitacaoId: u.solicitacaoId,
          dadosDepois: {
            tipo: 'PATIO_MOVIMENTACAO',
            movTipo: dto.tipo,
            unidadeIso: u.unidadeIso,
          },
        },
        tx,
      );
      return u;
    });

    this.emitPatio('PATIO_MOVIMENTACAO', operadorId, unidade.solicitacaoId, {
      unidadeIso: unidade.unidadeIso,
      movTipo: dto.tipo,
    });

    if (destinoId) await this.checkOcupacaoCritica(destinoId, operadorId);
    void this.yardSnapshot.onYardMutation([unidade.solicitacao.clienteId]);

    return updated;
  }

  async prepararGateOut(solicitacaoId: string, operadorId: string) {
    const count = await this.prisma.patioUnidade.updateMany({
      where: {
        solicitacaoId,
        status: { in: [PatioStatus.ESTOCADO, PatioStatus.SEPARADO, PatioStatus.MOVIMENTANDO] },
      },
      data: { status: PatioStatus.AGUARDANDO_GATE_OUT },
    });
    if (!count.count) throw new NotFoundException('Nenhuma unidade ativa no pátio para esta solicitação');

    await this.prisma.solicitacao.update({
      where: { id: solicitacaoId },
      data: { status: StatusSolicitacao.AGUARDANDO_GATE_OUT },
    });

    this.emitPatio('PATIO_PREPARAR_GATE_OUT', operadorId, solicitacaoId, { unidades: count.count });
    return { ok: true, unidades: count.count };
  }

  /** Gate Check-Out: libera posições e encerra rastreio ativo. */
  async finalizeFromGateOut(gateInId: string, operadorId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    await db.patioUnidade.updateMany({
      where: { gateInId },
      data: {
        posicaoAtualId: null,
        status: PatioStatus.AGUARDANDO_GATE_OUT,
      },
    });
    this.emitPatio('PATIO_GATE_OUT', operadorId, undefined, { gateInId });
  }

  async inventario() {
    const [posicoes, unidades, semPosicao] = await Promise.all([
      this.prisma.patioPosicao.findMany({
        orderBy: { codigoBaia: 'asc' },
        include: {
          unidadesAtuais: {
            include: {
              solicitacao: {
                select: {
                  id: true,
                  protocolo: true,
                  clienteId: true,
                  giroEstimado: true,
                  cliente: { select: { razaoSocial: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.patioUnidade.findMany({
        where: {
          status: {
            notIn: [PatioStatus.AGUARDANDO_GATE_OUT],
          },
          solicitacao: { status: { in: [StatusSolicitacao.EM_PATIO, StatusSolicitacao.AGUARDANDO_GATE_OUT] } },
        },
        include: {
          posicaoAtual: true,
          solicitacao: { select: { clienteId: true, protocolo: true } },
        },
      }),
      this.prisma.patioUnidade.findMany({
        where: {
          posicaoAtualId: null,
          status: { in: [PatioStatus.SEPARADO, PatioStatus.MOVIMENTANDO] },
        },
        select: { id: true, unidadeIso: true, status: true, solicitacaoId: true },
      }),
    ]);

    const now = Date.now();
    let sumHoras = 0;
    let nTempo = 0;
    const porCliente = new Map<string, number>();
    let reefers = 0;

    for (const u of unidades) {
      if (u.refrigerado) reefers++;
      const h = (now - u.createdAt.getTime()) / 3_600_000;
      if (h >= 0 && h < 24 * 90) {
        sumHoras += h;
        nTempo++;
      }
      const cid = u.solicitacao.clienteId;
      porCliente.set(cid, (porCliente.get(cid) ?? 0) + 1);
    }

    const baias = posicoes.map((p) => {
      const ocupacao = p.unidadesAtuais.length;
      const ratio = p.capacidade ? ocupacao / p.capacidade : 0;
      let cor: 'verde' | 'amarelo' | 'vermelho' = 'verde';
      if (ratio >= 1) cor = 'vermelho';
      else if (ratio >= 0.75) cor = 'amarelo';

      return {
        id: p.id,
        codigoBaia: p.codigoBaia,
        comprimento: p.comprimento,
        largura: p.largura,
        capacidade: p.capacidade,
        ocupacao,
        ratio: Math.round(ratio * 1000) / 10,
        cor,
        unidades: p.unidadesAtuais.map((u) => ({
          id: u.id,
          unidadeIso: u.unidadeIso,
          status: u.status,
          refrigerado: u.refrigerado,
          protocolo: u.solicitacao.protocolo,
          cliente: u.solicitacao.cliente?.razaoSocial ?? '—',
          giroEstimado: u.solicitacao.giroEstimado ?? null,
        })),
      };
    });

    const divergencias = semPosicao.map((u) => ({
      unidadeId: u.id,
      unidadeIso: u.unidadeIso,
      status: u.status,
      solicitacaoId: u.solicitacaoId,
      motivo: 'Container sem posição física atribuída',
    }));

    if (divergencias.length) {
      this.emitPatio('PATIO_DIVERGENCIA', 'system', undefined, { total: divergencias.length });
    }

    return {
      geradoEm: new Date().toISOString(),
      lotacaoTotal: unidades.length,
      capacidadeTotal: posicoes.reduce((s, p) => s + p.capacidade, 0),
      reefersLigados: reefers,
      mediaHorasArmazenado: nTempo ? Math.round((sumHoras / nTempo) * 10) / 10 : null,
      contagemPorCliente: [...porCliente.entries()].map(([clienteId, total]) => ({
        clienteId,
        total,
      })),
      divergencias,
      baias,
    };
  }

  async historicoUnidade(unidadeIsoRaw: string) {
    const iso = normalizeContainerIso(unidadeIsoRaw).replace(/\s/g, '').toUpperCase();
    const rows = await this.prisma.patioUnidade.findMany({
      where: { unidadeIso: iso },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        posicaoAtual: true,
        solicitacao: { select: { protocolo: true, status: true } },
        gateIn: { select: { id: true, dataHora: true } },
        movimentacoes: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            operador: { select: { email: true } },
            origem: { select: { codigoBaia: true } },
            destino: { select: { codigoBaia: true } },
          },
        },
      },
    });
    if (!rows.length) throw new NotFoundException('Unidade não encontrada no pátio');
    return { unidadeIso: iso, registros: rows };
  }

  async listByGateIn(gateInId: string) {
    return this.prisma.patioUnidade.findMany({
      where: { gateInId },
      orderBy: { unidadeIso: 'asc' },
      include: {
        posicaoAtual: { select: { id: true, codigoBaia: true } },
        solicitacao: { select: { giroEstimado: true } },
      },
    });
  }

  private async resolveBaia(codigo: string) {
    const baia = await this.prisma.patioPosicao.findUnique({
      where: { codigoBaia: codigo.trim().toUpperCase() },
    });
    if (!baia) {
      throw new BadRequestException(`Baia "${codigo}" inexistente.`);
    }
    return baia;
  }

  private async assertCapacidade(posicaoId: string, excludeUnidadeId: string) {
    const pos = await this.prisma.patioPosicao.findUnique({
      where: { id: posicaoId },
      include: {
        unidadesAtuais: {
          where: { id: { not: excludeUnidadeId } },
        },
      },
    });
    if (!pos) throw new BadRequestException('Baia inválida.');
    if (pos.unidadesAtuais.length >= pos.capacidade) {
      throw new BadRequestException(`Baia ${pos.codigoBaia} cheia (capacidade ${pos.capacidade}).`);
    }
  }

  private async checkOcupacaoCritica(posicaoId: string, operadorId: string) {
    const pos = await this.prisma.patioPosicao.findUnique({
      where: { id: posicaoId },
      include: { _count: { select: { unidadesAtuais: true } } },
    });
    if (!pos) return;
    const ratio = pos._count.unidadesAtuais / pos.capacidade;
    if (ratio >= OCUPACAO_CRITICA_RATIO) {
      this.emitPatio('PATIO_OCUPACAO_CRITICA', operadorId, undefined, {
        baia: pos.codigoBaia,
        ocupacao: pos._count.unidadesAtuais,
        capacidade: pos.capacidade,
      });
    }
  }

  private async touchPilhaLogica(
    tx: Prisma.TransactionClient,
    clienteId: string,
    codigoBaia: string,
    patioPosicaoId: string,
  ): Promise<void> {
    const codigo = codigoBaia.trim().toUpperCase();
    const existing = await tx.pilhaLogica.findUnique({
      where: { clienteId_codigo: { clienteId, codigo } },
    });
    if (existing) {
      await withOcc(() =>
        tx.pilhaLogica.update({
          where: { id: existing.id, version: existing.version },
          data: { version: { increment: 1 }, patioPosicaoId },
        }),
      );
      return;
    }
    await tx.pilhaLogica.create({
      data: { clienteId, codigo, patioPosicaoId },
    });
  }

  private emitPatio(
    tipo: string,
    userId: string,
    solicitacaoId: string | undefined,
    contexto: Record<string, unknown>,
  ) {
    this.securityEvents.emit({
      type: 'CRITICAL_EVENT',
      tipo,
      userId: userId === 'system' ? undefined : userId,
      solicitacaoId,
      contexto,
    });
  }
}
