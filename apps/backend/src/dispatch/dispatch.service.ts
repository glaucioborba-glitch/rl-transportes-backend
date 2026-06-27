import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcaoAuditoria,
  ModalidadeTransporte,
  StatusAgendamentoTerminal,
  StatusMotorista,
  StatusOrdemTransporte,
} from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEmitterService } from '../realtime/realtime-emitter.service';
import { PRISMA_SERIALIZABLE_TX } from '../prisma/transaction-options';
import { AssignDispatchDto } from './dto/assign-dispatch.dto';
import { UpdateOrdemStatusDto } from './dto/update-ordem-status.dto';
import {
  assertOrdemStatusTransition,
  timestampFieldForStatus,
} from './ordem-transporte.fsm';

function formatAgendamentoCard(a: {
  id: string;
  numeroIso: string;
  dataRef: Date;
  turno: string;
  tipoOperacao: string;
  statusCarga: string;
  localOrigem: string | null;
  localDestino: string | null;
  modalidadeTransporte: string;
  cliente: { razaoSocial: string; nomeFantasia: string | null };
  solicitacao: {
    protocolo: string | null;
    containersSolicitacao: { booking: string; unidade: string }[];
  } | null;
}) {
  const booking =
    a.solicitacao?.containersSolicitacao.find(
      (c) => c.unidade.replace(/\s/g, '').toUpperCase() === a.numeroIso.replace(/\s/g, '').toUpperCase(),
    )?.booking ??
    a.solicitacao?.containersSolicitacao[0]?.booking ??
    null;

  return {
    agendamentoId: a.id,
    numeroIso: a.numeroIso,
    dataRef: a.dataRef.toISOString().slice(0, 10),
    turno: a.turno,
    tipoOperacao: a.tipoOperacao,
    statusCarga: a.statusCarga,
    origem: a.localOrigem,
    destino: a.localDestino,
    clienteNome: a.cliente.nomeFantasia ?? a.cliente.razaoSocial,
    protocolo: a.solicitacao?.protocolo ?? null,
    booking,
  };
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeEmitterService,
  ) {}

  async listarPendentes() {
    const rows = await this.prisma.agendamentoTerminal.findMany({
      where: {
        modalidadeTransporte: ModalidadeTransporte.FROTA_FL,
        status: { not: StatusAgendamentoTerminal.CANCELADO },
        ordensTransporte: { none: {} },
      },
      orderBy: [{ dataRef: 'asc' }, { turno: 'asc' }],
      include: {
        cliente: { select: { razaoSocial: true, nomeFantasia: true } },
        solicitacao: {
          include: { containersSolicitacao: { select: { booking: true, unidade: true } } },
        },
      },
    });

    return rows.map(formatAgendamentoCard);
  }

  async board() {
    const [pendentes, motoristas] = await Promise.all([
      this.listarPendentes(),
      this.prisma.motorista.findMany({
        where: { status: { in: [StatusMotorista.DISPONIVEL, StatusMotorista.EM_VIAGEM] } },
        orderBy: { nome: 'asc' },
        include: {
          ordensTransporte: {
            where: { status: { not: StatusOrdemTransporte.CONCLUIDA } },
            include: {
              agendamento: {
                include: {
                  cliente: { select: { razaoSocial: true, nomeFantasia: true } },
                  solicitacao: {
                    include: { containersSolicitacao: { select: { booking: true, unidade: true } } },
                  },
                },
              },
              veiculo: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    return {
      pendentes,
      motoristas: motoristas.map((m) => ({
        id: m.id,
        nome: m.nome,
        telefone: m.telefone,
        status: m.status,
        ordemAtiva: m.ordensTransporte[0]
          ? {
              id: m.ordensTransporte[0].id,
              status: m.ordensTransporte[0].status,
              veiculoPlaca: m.ordensTransporte[0].veiculo.placa,
              ...formatAgendamentoCard(m.ordensTransporte[0].agendamento),
            }
          : null,
      })),
    };
  }

  async assign(dto: AssignDispatchDto, actorUserId: string) {
    const agendamento = await this.prisma.agendamentoTerminal.findUnique({
      where: { id: dto.agendamentoId },
      include: { ordensTransporte: true },
    });
    if (!agendamento) throw new NotFoundException('Agendamento não encontrado');
    if (agendamento.modalidadeTransporte !== ModalidadeTransporte.FROTA_FL) {
      throw new BadRequestException('Agendamento não é da modalidade FROTA_FL.');
    }
    if (agendamento.ordensTransporte.length > 0) {
      throw new ConflictException('Agendamento já possui ordem de transporte.');
    }

    const motorista = await this.prisma.motorista.findUnique({ where: { id: dto.motoristaId } });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');
    if (motorista.status !== StatusMotorista.DISPONIVEL) {
      throw new ConflictException('Motorista indisponível para despacho.');
    }

    const veiculo = await this.prisma.veiculo.findUnique({ where: { id: dto.veiculoId } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado');

    const now = new Date();

    const ot = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ordemTransporte.create({
        data: {
          agendamentoId: dto.agendamentoId,
          motoristaId: dto.motoristaId,
          veiculoId: dto.veiculoId,
          status: StatusOrdemTransporte.DESPACHADA,
          dataDespacho: now,
        },
        include: {
          agendamento: {
            include: {
              cliente: { select: { razaoSocial: true, nomeFantasia: true } },
              solicitacao: {
                include: { containersSolicitacao: { select: { booking: true, unidade: true } } },
              },
            },
          },
          motorista: true,
          veiculo: true,
        },
      });

      await tx.motorista.update({
        where: { id: dto.motoristaId },
        data: { status: StatusMotorista.EM_VIAGEM },
      });

      await this.auditoria.registrar(
        {
          tabela: 'ordens_transporte',
          registroId: created.id,
          acao: AcaoAuditoria.INSERT,
          usuario: actorUserId,
          dadosDepois: { agendamentoId: dto.agendamentoId, motoristaId: dto.motoristaId },
        },
        tx,
      );

      return created;
    }, PRISMA_SERIALIZABLE_TX);

    const board = await this.board();
    this.realtime.emitDispatchUpdated({
      source: 'assign',
      ordemId: ot.id,
      board,
    });

    return ot;
  }

  async viagemAtivaMotorista(usuarioId: string) {
    const motorista = await this.prisma.motorista.findUnique({
      where: { usuarioId },
      include: {
        ordensTransporte: {
          where: { status: { not: StatusOrdemTransporte.CONCLUIDA } },
          include: {
            agendamento: {
              include: {
                cliente: { select: { razaoSocial: true, nomeFantasia: true } },
                solicitacao: {
                  include: { containersSolicitacao: { select: { booking: true, unidade: true } } },
                },
              },
            },
            veiculo: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!motorista) {
      throw new NotFoundException('Perfil de motorista não vinculado a este usuário.');
    }

    const ot = motorista.ordensTransporte[0];
    if (!ot) return { motorista: { id: motorista.id, nome: motorista.nome }, viagem: null };

    return {
      motorista: { id: motorista.id, nome: motorista.nome, status: motorista.status },
      viagem: {
        ordemId: ot.id,
        status: ot.status,
        veiculoPlaca: ot.veiculo.placa,
        podFotoUrl: ot.podFotoUrl,
        ...formatAgendamentoCard(ot.agendamento),
      },
    };
  }

  async atualizarStatus(
    ordemId: string,
    dto: UpdateOrdemStatusDto,
    actorUserId: string,
    opts?: { motoristaUsuarioId?: string; podFile?: Express.Multer.File },
  ) {
    const ot = await this.prisma.ordemTransporte.findUnique({
      where: { id: ordemId },
      include: { motorista: true },
    });
    if (!ot) throw new NotFoundException('Ordem de transporte não encontrada');

    if (opts?.motoristaUsuarioId && ot.motorista.usuarioId !== opts.motoristaUsuarioId) {
      throw new ForbiddenException('Ordem não pertence ao motorista autenticado.');
    }

    assertOrdemStatusTransition(ot.status, dto.status);

    const tsField = timestampFieldForStatus(dto.status);
    const now = new Date();
    let podFotoUrl = dto.podFotoUrl ?? ot.podFotoUrl;

    if (dto.status === StatusOrdemTransporte.CONCLUIDA && opts?.podFile) {
      podFotoUrl = this.persistPod(ordemId, opts.podFile);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ordemTransporte.update({
        where: { id: ordemId },
        data: {
          status: dto.status,
          ...(tsField ? { [tsField]: now } : {}),
          ...(dto.status === StatusOrdemTransporte.CONCLUIDA && podFotoUrl ? { podFotoUrl } : {}),
        },
        include: {
          agendamento: true,
          motorista: true,
          veiculo: true,
        },
      });

      if (dto.status === StatusOrdemTransporte.CONCLUIDA) {
        await tx.motorista.update({
          where: { id: ot.motoristaId },
          data: { status: StatusMotorista.DISPONIVEL },
        });
      }

      await this.auditoria.registrar(
        {
          tabela: 'ordens_transporte',
          registroId: ordemId,
          acao: AcaoAuditoria.UPDATE,
          usuario: actorUserId,
          dadosDepois: { status: dto.status, podFotoUrl },
        },
        tx,
      );

      return row;
    });

    const board = await this.board();
    this.realtime.emitDispatchUpdated({
      source: 'status',
      ordemId,
      status: dto.status,
      board,
    });

    return updated;
  }

  async listarVeiculos() {
    return this.prisma.veiculo.findMany({ orderBy: { placa: 'asc' } });
  }

  private persistPod(ordemId: string, file: Express.Multer.File): string {
    const base = path.join(process.cwd(), 'uploads', 'dispatch-pod', ordemId);
    fs.mkdirSync(base, { recursive: true });
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'pod.jpg';
    const name = `${randomUUID()}_${safe}`;
    fs.writeFileSync(path.join(base, name), file.buffer);
    return `local://dispatch-pod/${ordemId}/${name}`;
  }
}
