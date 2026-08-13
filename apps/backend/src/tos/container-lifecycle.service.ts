import {

  BadRequestException,

  Injectable,

  Logger,

  NotFoundException,

  UnprocessableEntityException,

} from '@nestjs/common';

import { TosEventEmitter } from './tos-event-emitter';

import {

  AcaoAuditoria,

  ContainerEventType,

  MomentoAvaria,

  Prisma,

  StatusAgendamentoTerminal,

  TipoContainerTos,

} from '@prisma/client';

import { AuditoriaService } from '../auditoria/auditoria.service';

import { withOcc } from '../common/prisma/occ.util';

import { normalizeContainerIso } from '../common/utils/data-sanitize';

import { OutboxService } from '../outbox/outbox.service';

import { NotificationEnqueueService } from '../notification/notification-enqueue.service';

import { PrismaService } from '../prisma/prisma.service';

import { YardSnapshotService } from '../yard-read/yard-snapshot.service';

import {

  assertGateInCompleted,

  assertGateOutCompleted,

  assertReeferPlugged,
  assertReeferUnplugged,

  type GateInPayload,

  type RepairApprovalOrigin,

} from './container-fsm.guards';

import {

  ContainerLifecycleState,

  deriveStateFromEvents,

  FSM_TRANSITIONS,

  type ContainerEventRow,

} from './container-fsm.types';



export const CONTAINER_DISPATCHED_EVENT = 'container.dispatched';



export type ContainerDispatchedPayload = {

  containerId: string;

  clienteId: string;

  agendamentoId: string;

  gateInAt: Date;

  gateOutAt: Date;

  diasEstadia: number;

  tipo: TipoContainerTos;

  numero: string;

  solicitacaoId: string | null;

};



export type TransitionResult = {

  eventId: string;

  containerId: string;

  eventType: ContainerEventType;

  state: ContainerLifecycleState;

  createdAt: Date;

  version: number;

};



@Injectable()

export class ContainerLifecycleService {

  private readonly logger = new Logger(ContainerLifecycleService.name);



  constructor(

    private readonly prisma: PrismaService,

    private readonly auditoria: AuditoriaService,

    private readonly eventEmitter: TosEventEmitter,

    private readonly outbox: OutboxService,

    private readonly notificationEnqueue: NotificationEnqueueService,

    private readonly yardSnapshot: YardSnapshotService,

  ) {}



  async createContainer(

    data: {

      numero: string;

      tipo: TipoContainerTos;

      clienteId: string;

      agendamentoId: string;

    },

    actorUserId: string,

  ) {

    const numero = normalizeContainerIso(data.numero);

    const agendamento = await this.prisma.agendamentoTerminal.findUnique({

      where: { id: data.agendamentoId },

    });

    if (!agendamento) throw new NotFoundException('Agendamento não encontrado');

    if (agendamento.status === StatusAgendamentoTerminal.CANCELADO) {

      throw new BadRequestException('Agendamento cancelado');

    }

    if (agendamento.clienteId !== data.clienteId) {

      throw new BadRequestException('Agendamento não pertence ao cliente informado');

    }

    if (normalizeContainerIso(agendamento.numeroIso) !== numero) {

      throw new BadRequestException('Número ISO não confere com o agendamento');

    }



    const cliente = await this.prisma.cliente.findFirst({

      where: { id: data.clienteId, deletedAt: null },

    });

    if (!cliente) throw new NotFoundException('Cliente não encontrado');



    const container = await this.prisma.container.create({

      data: {

        numero,

        tipo: data.tipo,

        clienteId: data.clienteId,

        agendamentoId: data.agendamentoId,

      },

    });



    await this.transitionState(

      container.id,

      ContainerEventType.SCHEDULED,

      { agendamentoId: data.agendamentoId },

      actorUserId,

    );



    return this.getContainerWithEvents(container.id);

  }



  async transitionState(

    containerId: string,

    eventType: ContainerEventType,

    payload: Record<string, unknown> = {},

    actorUserId?: string,

  ): Promise<TransitionResult> {

    const container = await this.prisma.container.findUnique({

      where: { id: containerId },

      include: {

        agendamento: true,

        eventos: { orderBy: { createdAt: 'asc' } },

      },

    });

    if (!container) throw new NotFoundException('Contêiner não encontrado');



    const history: ContainerEventRow[] = container.eventos.map((e) => ({

      eventType: e.eventType,

      payload: e.payload,

      createdAt: e.createdAt,

    }));

    const currentState = deriveStateFromEvents(history);

    const rule = FSM_TRANSITIONS[eventType];



    if (!rule.from.includes(currentState)) {

      throw new UnprocessableEntityException(

        `Transição inválida: evento ${eventType} não permitido no estado ${currentState}.`,

      );

    }



    await this.applyGuards(eventType, payload, history, container);



    const extendedHistory = [...history];

    let dispatchedPayload: ContainerDispatchedPayload | null = null;



    const result = await this.prisma.$transaction(async (tx) => {

      const event = await tx.containerEvent.create({

        data: {

          containerId,

          eventType,

          payload: payload as Prisma.InputJsonValue,

          criadoPor: actorUserId ?? null,

        },

      });



      extendedHistory.push({ eventType, payload, createdAt: event.createdAt });

      const newState = deriveStateFromEvents(extendedHistory);



      const updatedContainer = await withOcc(() =>

        tx.container.update({

          where: { id: containerId, version: container.version },

          data: { version: { increment: 1 } },

        }),

      );



      if (eventType === ContainerEventType.GATE_OUT_COMPLETED) {

        dispatchedPayload = this.buildDispatchedPayload(container, extendedHistory);

        await this.outbox.enqueue(tx, {

          aggregateType: 'Container',

          aggregateId: containerId,

          eventType: 'BILLING_TRIGGERED',

          payload: {

            ...dispatchedPayload,

            gateInAt: dispatchedPayload.gateInAt.toISOString(),

            gateOutAt: dispatchedPayload.gateOutAt.toISOString(),

          } as Prisma.InputJsonValue,

        });

      }



      if (

        (eventType === ContainerEventType.GATE_IN_COMPLETED ||

          eventType === ContainerEventType.YARD_ALLOCATED) &&

        container.agendamento.solicitacaoId

      ) {

        const sol = await tx.solicitacao.findUnique({

          where: { id: container.agendamento.solicitacaoId },

          select: { id: true, protocolo: true },

        });

        if (sol) {

          await this.notificationEnqueue.enqueueOperacionalInTx(tx, {

            kind:

              eventType === ContainerEventType.YARD_ALLOCATED

                ? 'OPERACIONAL_ARMAZENADO'

                : 'OPERACIONAL_GATE_IN',

            solicitacaoId: sol.id,

            containerIso: container.numero,

            protocolo: sol.protocolo,

            eventAt: event.createdAt,

            dedupeKey: `${event.id}:${eventType}`,

          });

        }

      }



      await this.auditoria.registrar(

        {

          tabela: 'container_events',

          registroId: event.id,

          acao: AcaoAuditoria.INSERT,

          usuario: actorUserId ?? 'system',

          dadosDepois: {

            containerId,

            eventType,

            state: newState,

            payload,

            version: updatedContainer.version,

          },

        },

        tx,

      );



      return {

        eventId: event.id,

        containerId,

        eventType,

        state: newState,

        createdAt: event.createdAt,

        version: updatedContainer.version,

      };

    });



    if (dispatchedPayload) {

      this.logger.log(`Outbox BILLING_TRIGGERED enfileirado — contêiner ${container.numero}`);

      this.eventEmitter.emit(CONTAINER_DISPATCHED_EVENT, dispatchedPayload);

    }



    if (

      eventType === ContainerEventType.YARD_ALLOCATED ||

      eventType === ContainerEventType.PRE_MOUNTING_DONE ||

      eventType === ContainerEventType.GATE_OUT_COMPLETED

    ) {

      void this.yardSnapshot.onYardMutation([container.clienteId]);

    }



    return result;

  }



  private buildDispatchedPayload(

    container: {

      id: string;

      numero: string;

      tipo: TipoContainerTos;

      clienteId: string;

      agendamentoId: string;

      agendamento: { solicitacaoId: string | null };

    },

    events: ContainerEventRow[],

  ): ContainerDispatchedPayload {

    const gateIn = events.find((e) => e.eventType === ContainerEventType.GATE_IN_COMPLETED);

    const gateOut = events.find((e) => e.eventType === ContainerEventType.GATE_OUT_COMPLETED);

    if (!gateIn || !gateOut) {

      throw new BadRequestException('Gate-in/out incompletos para despacho.');

    }



    const msPerDay = 86_400_000;

    const diasEstadia = Math.max(

      1,

      Math.ceil((gateOut.createdAt.getTime() - gateIn.createdAt.getTime()) / msPerDay),

    );



    return {

      containerId: container.id,

      clienteId: container.clienteId,

      agendamentoId: container.agendamentoId,

      gateInAt: gateIn.createdAt,

      gateOutAt: gateOut.createdAt,

      diasEstadia,

      tipo: container.tipo,

      numero: container.numero,

      solicitacaoId: container.agendamento.solicitacaoId,

    };

  }



  private async applyGuards(

    eventType: ContainerEventType,

    payload: Record<string, unknown>,

    history: ContainerEventRow[],

    container: {

      id: string;

      numero: string;

      tipo: TipoContainerTos;

      clienteId: string;

      agendamento: {

        id: string;

        numeroIso: string;

        clienteId: string;

        status: StatusAgendamentoTerminal;

      };

    },

  ): Promise<void> {

    switch (eventType) {

      case ContainerEventType.GATE_IN_COMPLETED:

        assertGateInCompleted(

          payload as GateInPayload,

          history,

          container.agendamento,

          container.numero,

          container.clienteId,

        );

        break;

      case ContainerEventType.GATE_OUT_COMPLETED:

        assertGateOutCompleted(history);

        break;

      case ContainerEventType.REEFER_PLUGGED:

        assertReeferPlugged(container.tipo);

        break;

      case ContainerEventType.REEFER_UNPLUGGED:

        assertReeferUnplugged(container.tipo);

        break;

      default:

        break;

    }

  }



  async logReeferTemperature(

    containerId: string,

    temperaturaAtual: number,

    actorUserId: string,

  ) {

    const container = await this.prisma.container.findUnique({

      where: { id: containerId },

      include: {

        agendamento: {

          include: {

            solicitacao: {

              include: { containersSolicitacao: true },

            },

          },

        },

      },

    });

    if (!container) throw new NotFoundException('Contêiner não encontrado');

    if (container.tipo !== TipoContainerTos.REEFER) {

      throw new BadRequestException('Log de temperatura só se aplica a contêineres REEFER');

    }



    const setPoint = this.resolveSetPoint(container);

    const divergencia = setPoint !== null ? Math.abs(temperaturaAtual - setPoint) : 0;

    const alerta = setPoint !== null && divergencia > 2;



    if (alerta) {

      this.logger.warn(

        `[REEFER ALERT] Container ${container.numero}: temp=${temperaturaAtual}°C setPoint=${setPoint}°C (Δ=${divergencia.toFixed(1)}°C)`,

      );

    }



    const result = await this.transitionState(

      containerId,

      ContainerEventType.REEFER_TEMP_LOGGED,

      {

        temperaturaAtual,

        setPoint,

        divergenciaGraus: setPoint !== null ? divergencia : null,

        alerta,

      },

      actorUserId,

    );



    return { ...result, alerta, setPoint, temperaturaAtual };

  }



  async aprovarReparo(

    containerId: string,

    data: {

      origem: RepairApprovalOrigin;

      observacao?: string;

      valorReparo?: number;

    },

    actorUserId: string,

  ) {

    const container = await this.prisma.container.findUnique({

      where: { id: containerId },

      include: { eventos: { orderBy: { createdAt: 'asc' } } },

    });

    if (!container) throw new NotFoundException('Contêiner não encontrado');



    const history: ContainerEventRow[] = container.eventos.map((e) => ({

      eventType: e.eventType,

      payload: e.payload,

      createdAt: e.createdAt,

    }));

    const state = deriveStateFromEvents(history);

    if (state !== ContainerLifecycleState.REPAIR_PENDING) {

      throw new BadRequestException('Não há reparo pendente de aprovação para este contêiner.');

    }



    return this.transitionState(

      containerId,

      ContainerEventType.REPAIR_APPROVED,

      {

        origem: data.origem,

        observacao: data.observacao ?? null,

        valorReparo: data.valorReparo ?? null,

        aprovadoPor: actorUserId,

      },

      actorUserId,

    );

  }



  async registrarAvaria(

    containerId: string,

    data: { descricao: string; fotos: string[]; momento: MomentoAvaria },

    actorUserId: string,

  ) {

    const container = await this.prisma.container.findUnique({ where: { id: containerId } });

    if (!container) throw new NotFoundException('Contêiner não encontrado');



    const avaria = await this.prisma.avariaRecord.create({

      data: {

        containerId,

        descricao: data.descricao.trim(),

        fotos: data.fotos,

        momento: data.momento,

      },

    });



    await this.auditoria.registrar({

      tabela: 'avaria_records',

      registroId: avaria.id,

      acao: AcaoAuditoria.INSERT,

      usuario: actorUserId,

      dadosDepois: { containerId, momento: data.momento },

    });



    return avaria;

  }



  async getContainerWithEvents(containerId: string) {

    const container = await this.prisma.container.findUnique({

      where: { id: containerId },

      include: {

        eventos: { orderBy: { createdAt: 'asc' } },

        avarias: { orderBy: { createdAt: 'asc' } },

        agendamento: true,

        cliente: { select: { id: true, razaoSocial: true, cpfCnpj: true } },

      },

    });

    if (!container) throw new NotFoundException('Contêiner não encontrado');



    const history: ContainerEventRow[] = container.eventos.map((e) => ({

      eventType: e.eventType,

      payload: e.payload,

      createdAt: e.createdAt,

    }));



    return {

      ...container,

      estadoAtual: deriveStateFromEvents(history),

    };

  }



  private resolveSetPoint(container: {

    numero: string;

    agendamento: {

      solicitacao: {

        containersSolicitacao: { unidade: string; setPoint: number | null; refrigerado: boolean }[];

      } | null;

    };

  }): number | null {

    const sol = container.agendamento.solicitacao;

    if (!sol) return null;

    const iso = normalizeContainerIso(container.numero);

    const match = sol.containersSolicitacao.find(

      (c) => normalizeContainerIso(c.unidade) === iso && c.refrigerado,

    );

    return match?.setPoint ?? null;

  }

}


