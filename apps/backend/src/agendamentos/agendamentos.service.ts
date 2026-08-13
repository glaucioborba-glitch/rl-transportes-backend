import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AcaoAuditoria,
  AgendamentoTerminal,
  CategoriaAuditLog,
  ModalidadeTransporte,
  Prisma,
  StatusAgendamentoTerminal,
  TurnoAgendamento,
} from '@prisma/client';
import { appendAuditTrailEntry } from '../audit-trail/audit-trail-capture.util';
import { AuditContextService } from '../audit-trail/audit-context.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { FEATURE_FLAG_KEYS } from '../feature-flags/feature-flag.keys';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';
import { PrismaService } from '../prisma/prisma.service';
import { PRISMA_SERIALIZABLE_TX } from '../prisma/transaction-options';
import { ServicosLogisticosService } from '../servicos-logisticos/servicos-logisticos.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { normalizeContainerIso } from '../common/utils/data-sanitize';
import { TosEventEmitter } from '../tos/tos-event-emitter';
import {
  assertAgendamentoTransporte,
  normalizeLocalEndereco,
  TRANSPORTE_SOLICITADO_EVENT,
  type TransporteSolicitadoPayload,
} from './agendamento-transporte.util';
import { diaSemanaCodigo, isFimDeSemana, parseHoraMinutos, resolveTurnoConfig, turnoAtual, turnoAtualFromConfig } from './agendamentos-turno.util';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { UpdateCapacidadeTurnoDto } from './dto/update-capacidade-turno.dto';

@Injectable()
export class AgendamentosService {
  private readonly logger = new Logger(AgendamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly servicosLogisticos: ServicosLogisticosService,
    private readonly eventEmitter: TosEventEmitter,
    private readonly flags: FeatureFlagService,
    private readonly tenantConfig: TenantConfigService,
    private readonly auditContext: AuditContextService,
  ) {}

  private parseDataRef(isoDate: string): Date {
    const d = new Date(`${isoDate}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('dataRef inválida (use ISO yyyy-mm-dd)');
    }
    return d;
  }

  /** Valida capacidade do turno antes de reservar N slots (ex.: Rodotrem = 2). */
  async assertCapacidadeTurno(
    dataRef: string,
    turno: TurnoAgendamento,
    reservas = 1,
    tx?: Prisma.TransactionClient,
    tenantId = DEFAULT_TENANT_ID,
  ): Promise<void> {
    const dataParsed = this.parseDataRef(dataRef);
    const db = tx ?? this.prisma;

    const config = await this.tenantConfig.getParametrosGerais(tenantId);
    const turnoConfig = resolveTurnoConfig(config.operacional.turnos, dataParsed, turno);

    if (!turnoConfig) {
      throw new BadRequestException(
        `Turno ${turno} inválido ou inativo para ${dataRef} (${diaSemanaCodigo(dataParsed)}).`,
      );
    }

    const limite = turnoConfig.capacidadeMaxima;
    const ocupados = await db.agendamentoTerminal.count({
      where: {
        tenantId,
        dataRef: dataParsed,
        turno,
        status: {
          notIn: [
            StatusAgendamentoTerminal.CANCELADO,
            StatusAgendamentoTerminal.CANCELADO_CLIENTE,
          ],
        },
      },
    });
    if (ocupados + reservas > limite) {
      throw new ConflictException(
        `Capacidade do turno ${turnoConfig.nome} (${limite}) excedida para ${dataRef} (${ocupados + reservas}/${limite}).`,
      );
    }
  }

  private async assertAntecedenciaMinima(dataRef: string, tenantId = DEFAULT_TENANT_ID): Promise<void> {
    const config = await this.tenantConfig.getParametrosGerais(tenantId);
    if (!config.operacional.validarAntecedenciaAgendamento) return;

    const antecedenciaMin = config.operacional.antecedenciaMinimaMin ?? 60;
    const dataAgendamento = this.parseDataRef(dataRef);
    const agora = new Date();
    const diffMin = (dataAgendamento.getTime() - agora.getTime()) / (1000 * 60);

    if (diffMin < antecedenciaMin) {
      throw new BadRequestException(
        `Agendamento requer ${antecedenciaMin} min de antecedência. ` +
          `Solicitado para ${dataRef} — faltam apenas ${Math.max(0, Math.round(diffMin))} min.`,
      );
    }
  }

  private async assertCalendarioOperacional(dataRef: string, tenantId = DEFAULT_TENANT_ID): Promise<void> {
    const config = await this.tenantConfig.getParametrosGerais(tenantId);
    const dataParsed = this.parseDataRef(dataRef);

    if (!config.operacional.operacaoFimSemana && isFimDeSemana(dataParsed)) {
      throw new BadRequestException(
        'Terminal não opera em finais de semana. Ative "Operação aos finais de semana" ou escolha dia útil.',
      );
    }

    const inicio = parseHoraMinutos(config.operacional.horarioFuncionamentoInicio);
    const fim = parseHoraMinutos(config.operacional.horarioFuncionamentoFim);
    if (inicio >= fim) {
      throw new BadRequestException('Horário de funcionamento do terminal está mal configurado.');
    }
  }

  private async assertTurnoValido(
    turno: TurnoAgendamento,
    dataRef: string,
    tenantId = DEFAULT_TENANT_ID,
  ): Promise<void> {
    const config = await this.tenantConfig.getParametrosGerais(tenantId);
    const dataParsed = this.parseDataRef(dataRef);
    const turnoConfig = resolveTurnoConfig(config.operacional.turnos, dataParsed, turno);
    if (!turnoConfig) {
      throw new BadRequestException(`Turno ${turno} inválido ou inativo para ${dataRef}.`);
    }
  }

  /** Validações completas antes de reservar slot (portal + intranet). */
  async validarReservaAgendamento(
    dataRef: string,
    turno: TurnoAgendamento,
    reservas = 1,
    tenantId = DEFAULT_TENANT_ID,
  ): Promise<void> {
    await this.assertCalendarioOperacional(dataRef, tenantId);
    await this.assertTurnoValido(turno, dataRef, tenantId);
    await this.assertAntecedenciaMinima(dataRef, tenantId);
    await this.assertCapacidadeTurno(dataRef, turno, reservas, undefined, tenantId);
  }

  /** Persiste agendamento terminal dentro de transação já aberta (solicitação v2). */
  async criarNaTransacao(
    tx: Prisma.TransactionClient,
    dto: CreateAgendamentoDto,
    actorUserId: string,
  ): Promise<AgendamentoTerminal> {
    const numeroIso = normalizeContainerIso(dto.numeroIso);
    const dataRef = this.parseDataRef(dto.dataRef);
    const st = dto.status ?? StatusAgendamentoTerminal.PENDENTE;
    const modalidade = dto.modalidadeTransporte ?? ModalidadeTransporte.FROTA_CLIENTE;

    assertAgendamentoTransporte({
      tipoOperacao: dto.tipoOperacao,
      modalidadeTransporte: modalidade,
      statusCarga: dto.statusCarga,
      localOrigem: dto.localOrigem,
      localDestino: dto.localDestino,
    });

    const localOrigem = normalizeLocalEndereco(dto.localOrigem);
    const localDestino = normalizeLocalEndereco(dto.localDestino);
    const valorFrete =
      dto.valorFrete != null ? new Prisma.Decimal(dto.valorFrete.toFixed(2)) : null;

    try {
      const row = await tx.agendamentoTerminal.create({
        data: {
          clienteId: dto.clienteId,
          solicitacaoId: dto.solicitacaoId ?? null,
          numeroIso,
          dataRef,
          turno: dto.turno,
          status: st,
          tipoOperacao: dto.tipoOperacao,
          modalidadeTransporte: modalidade,
          statusCarga: dto.statusCarga,
          localOrigem,
          localDestino,
          valorFrete,
        },
        include: { cliente: true, solicitacao: true },
      });

      await this.auditoria.registrar(
        {
          tabela: 'agendamentos_terminal',
          registroId: row.id,
          acao: AcaoAuditoria.INSERT,
          usuario: actorUserId,
          dadosDepois: row,
        },
        tx,
      );

      return row;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Já existe agendamento para este contêiner no mesmo turno, data e tipo de operação.',
        );
      }
      throw e;
    }
  }

  dispararTransporteSolicitado(payload: TransporteSolicitadoPayload): void {
    this.logger.log(
      `Disparando ${TRANSPORTE_SOLICITADO_EVENT} — ${payload.numeroIso} (${payload.tipoOperacao})`,
    );
    this.eventEmitter.emit(TRANSPORTE_SOLICITADO_EVENT, payload);
  }

  private buildTransporteSolicitadoPayload(
    row: AgendamentoTerminal,
    dataRefIso?: string,
  ): TransporteSolicitadoPayload {
    return {
      agendamentoId: row.id,
      clienteId: row.clienteId,
      numeroIso: row.numeroIso,
      tipoOperacao: row.tipoOperacao,
      modalidadeTransporte: row.modalidadeTransporte,
      statusCarga: row.statusCarga,
      localOrigem: row.localOrigem,
      localDestino: row.localDestino,
      dataRef: dataRefIso ?? row.dataRef.toISOString().slice(0, 10),
      turno: row.turno,
    };
  }

  /**
   * Rule engine pós-criação (spec triagem):
   * auto → CONFIRMADO (APROVADA_AGUARDANDO_GATE); senão FROTA_FL emite `transporte.solicitado`.
   */
  async posCriacao(agendamentoId: string, actorUserId: string): Promise<AgendamentoTerminal> {
    const row = await this.prisma.agendamentoTerminal.findUnique({ where: { id: agendamentoId } });
    if (!row || row.status !== StatusAgendamentoTerminal.PENDENTE) {
      if (!row) throw new NotFoundException('Agendamento não encontrado');
      return row;
    }

    if (await this.checkAutoAprovacao(row)) {
      return this.atualizarStatus(row.id, StatusAgendamentoTerminal.CONFIRMADO, actorUserId);
    }

    if (row.modalidadeTransporte === ModalidadeTransporte.FROTA_FL) {
      this.dispararTransporteSolicitado(this.buildTransporteSolicitadoPayload(row));
    }

    return row;
  }

  /** Bloqueio cliente/unidade, capacidade do turno e booking ISO válido. */
  async checkAutoAprovacao(
    agendamento: Pick<
      AgendamentoTerminal,
      'id' | 'clienteId' | 'solicitacaoId' | 'numeroIso' | 'dataRef' | 'turno'
    >,
  ): Promise<boolean> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: agendamento.clienteId },
      select: { cpfCnpj: true },
    });
    if (
      !(await this.flags.isEnabled(FEATURE_FLAG_KEYS.GATE_AUTO_APPROVE_ENABLED, {
        cnpj: cliente?.cpfCnpj,
      }))
    ) {
      return false;
    }

    const isoNorm = agendamento.numeroIso.replace(/\s/g, '').toUpperCase();

    const bloqueioUnidade = await this.prisma.unidade.findFirst({
      where: {
        movimentacaoBloqueada: true,
        numeroIso: { equals: isoNorm, mode: 'insensitive' },
        ...(agendamento.solicitacaoId ? { solicitacaoId: agendamento.solicitacaoId } : {}),
      },
      select: { id: true },
    });
    if (bloqueioUnidade) return false;

    if (agendamento.solicitacaoId) {
      const container = await this.prisma.containerSolicitacao.findFirst({
        where: {
          solicitacaoId: agendamento.solicitacaoId,
          unidade: { equals: isoNorm, mode: 'insensitive' },
        },
        select: { booking: true },
      });
      const booking = container?.booking?.trim();
      if (!booking || booking.length < 2) return false;
    }

    return true;
  }

  private async atualizarStatus(
    id: string,
    status: StatusAgendamentoTerminal,
    actorUserId: string,
    extra?: { motivoReprovacao?: string | null },
  ): Promise<AgendamentoTerminal> {
    const antes = await this.prisma.agendamentoTerminal.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Agendamento não encontrado');

    const row = await this.prisma.agendamentoTerminal.update({
      where: { id },
      data: {
        status,
        ...(extra?.motivoReprovacao !== undefined
          ? { motivoReprovacao: extra.motivoReprovacao }
          : {}),
      },
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        solicitacao: { select: { id: true, protocolo: true, status: true } },
      },
    });

    await this.auditoria.registrar({
      tabela: 'agendamentos_terminal',
      registroId: id,
      acao: AcaoAuditoria.UPDATE,
      usuario: actorUserId,
      dadosAntes: antes,
      dadosDepois: row,
    });

    return row;
  }

  async listarTriagemPendentes() {
    const rows = await this.prisma.agendamentoTerminal.findMany({
      where: { status: StatusAgendamentoTerminal.PENDENTE },
      orderBy: [{ dataRef: 'asc' }, { turno: 'asc' }, { createdAt: 'asc' }],
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        solicitacao: { select: { id: true, protocolo: true, status: true } },
      },
    });

    return rows.map((a) => ({
      id: a.id,
      protocolo: a.solicitacao?.protocolo ?? a.id.slice(0, 8).toUpperCase(),
      modalidadeTransporte: a.modalidadeTransporte,
      statusCarga: a.statusCarga,
      tipoOperacao: a.tipoOperacao,
      numeroIso: a.numeroIso,
      dataRef: a.dataRef.toISOString().slice(0, 10),
      turno: a.turno,
      clienteId: a.clienteId,
      clienteNome: a.cliente.nomeFantasia ?? a.cliente.razaoSocial,
      solicitacaoId: a.solicitacaoId,
      localOrigem: a.localOrigem,
      localDestino: a.localDestino,
      valorFrete: a.valorFrete != null ? Number(a.valorFrete) : null,
    }));
  }

  async aprovarTriagem(id: string, actorUserId: string) {
    const row = await this.prisma.agendamentoTerminal.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Agendamento não encontrado');
    if (row.status !== StatusAgendamentoTerminal.PENDENTE) {
      throw new ConflictException('Somente agendamentos PENDENTE podem ser aprovados na triagem.');
    }

    const updated = await this.atualizarStatus(id, StatusAgendamentoTerminal.CONFIRMADO, actorUserId, {
      motivoReprovacao: null,
    });

    if (updated.modalidadeTransporte === ModalidadeTransporte.FROTA_FL) {
      this.dispararTransporteSolicitado(this.buildTransporteSolicitadoPayload(updated));
    }

    return updated;
  }

  async reprovarTriagem(id: string, motivo: string, actorUserId: string) {
    const row = await this.prisma.agendamentoTerminal.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Agendamento não encontrado');
    if (row.status !== StatusAgendamentoTerminal.PENDENTE) {
      throw new ConflictException('Somente agendamentos PENDENTE podem ser reprovados na triagem.');
    }

    return this.atualizarStatus(id, StatusAgendamentoTerminal.CANCELADO, actorUserId, {
      motivoReprovacao: motivo.trim(),
    });
  }

  async criar(dto: CreateAgendamentoDto, actorUserId: string) {
    normalizeContainerIso(dto.numeroIso);
    this.parseDataRef(dto.dataRef);
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: dto.clienteId, deletedAt: null },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');

    if (dto.solicitacaoId) {
      const sol = await this.prisma.solicitacao.findFirst({
        where: { id: dto.solicitacaoId, deletedAt: null },
      });
      if (!sol) throw new NotFoundException('Solicitação não encontrada');
      if (sol.clienteId !== dto.clienteId) {
        this.servicosLogisticos.notificarEventoIntegridade({
          solicitacaoId: dto.solicitacaoId,
          clienteInformado: dto.clienteId,
          clienteReal: sol.clienteId,
        });
        throw new BadRequestException('Solicitação não pertence ao cliente informado');
      }
    }

    await this.assertCalendarioOperacional(dto.dataRef);
    await this.assertTurnoValido(dto.turno, dto.dataRef);
    await this.assertAntecedenciaMinima(dto.dataRef);
    await this.assertCapacidadeTurno(dto.dataRef, dto.turno, 1);

    try {
      const row = await this.prisma.$transaction(
        async (tx) => this.criarNaTransacao(tx, dto, actorUserId),
        PRISMA_SERIALIZABLE_TX,
      );
      return this.posCriacao(row.id, actorUserId);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Já existe agendamento para este contêiner no mesmo turno, data e tipo de operação.',
        );
      }
      throw e;
    }
  }

  /** Portal cliente — `clienteId` derivado do JWT. */
  async criarPortal(
    dto: Omit<CreateAgendamentoDto, 'clienteId' | 'valorFrete' | 'status'>,
    clienteId: string,
    actorUserId: string,
  ) {
    return this.criar(
      {
        ...dto,
        clienteId,
        status: StatusAgendamentoTerminal.PENDENTE,
      },
      actorUserId,
    );
  }

  async cancelar(id: string, actorUserId: string, tenantId = DEFAULT_TENANT_ID) {
    const agendamento = await this.prisma.agendamentoTerminal.findUnique({ where: { id } });
    if (!agendamento) throw new NotFoundException('Agendamento não encontrado');
    if (
      agendamento.status === StatusAgendamentoTerminal.CANCELADO ||
      agendamento.status === StatusAgendamentoTerminal.CANCELADO_CLIENTE
    ) {
      throw new ConflictException('Agendamento já está cancelado.');
    }

    const config = await this.tenantConfig.getParametrosGerais(tenantId);
    const limiteCancelamentoMin = config.operacional.cancelamentoSemPenalidadeMin ?? 120;
    const agora = new Date();
    const diffMin =
      (agendamento.dataRef.getTime() - agora.getTime()) / (1000 * 60);

    if (
      config.operacional.validarCancelamentoSemPenalidade &&
      diffMin < limiteCancelamentoMin
    ) {
      const actor = this.auditContext.resolveActor();
      await appendAuditTrailEntry(this.prisma, actor, {
        entidadeId: agendamento.id,
        entidadeTipo: 'AgendamentoTerminal',
        categoria: CategoriaAuditLog.OPERACIONAL,
        acao: 'CANCELAMENTO_TARDIO',
        dadosAnteriores: { status: agendamento.status },
        dadosNovos: {
          status: StatusAgendamentoTerminal.CANCELADO,
          tardio: true,
          minutosAntecedencia: Math.max(0, diffMin),
          limiteMinutos: limiteCancelamentoMin,
        },
      });

      await this.prisma.cliente.update({
        where: { id: agendamento.clienteId },
        data: { cancelamentosTardios: { increment: 1 } },
      });
    }

    return this.atualizarStatus(id, StatusAgendamentoTerminal.CANCELADO, actorUserId);
  }

  async filaDoDia(opts?: { dataRef?: string; turno?: TurnoAgendamento; tenantId?: string }) {
    const now = new Date();
    const dataIso = opts?.dataRef ?? now.toISOString().slice(0, 10);
    const dataParsed = this.parseDataRef(dataIso);
    const tenantId = opts?.tenantId ?? DEFAULT_TENANT_ID;
    const config = await this.tenantConfig.getParametrosGerais(tenantId);
    const turno =
      opts?.turno ?? turnoAtualFromConfig(config.operacional.turnos, now);

    const items = await this.prisma.agendamentoTerminal.findMany({
      where: {
        dataRef: dataParsed,
        turno,
        status: { in: [StatusAgendamentoTerminal.PENDENTE, StatusAgendamentoTerminal.CONFIRMADO] },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true } },
        solicitacao: {
          include: {
            unidades: true,
          },
        },
      },
    });

    return {
      dataRef: dataIso,
      turno,
      geradoEm: now.toISOString(),
      total: items.length,
      itens: items.map((a) => ({
        agendamentoId: a.id,
        numeroIso: a.numeroIso,
        statusAgendamento: a.status,
        tipoOperacao: a.tipoOperacao,
        modalidadeTransporte: a.modalidadeTransporte,
        statusCarga: a.statusCarga,
        localOrigem: a.localOrigem,
        localDestino: a.localDestino,
        solicitacaoId: a.solicitacaoId,
        statusSolicitacao: a.solicitacao?.status ?? null,
        protocolo: a.solicitacao?.protocolo ?? null,
        clienteId: a.clienteId,
        clienteNome: a.cliente.nomeFantasia ?? a.cliente.razaoSocial,
      })),
    };
  }

  async atualizarCapacidade(dto: UpdateCapacidadeTurnoDto, actorUserId: string) {
    const row = await this.prisma.capacidadeTurnoTerminal.upsert({
      where: { turno: dto.turno },
      create: { turno: dto.turno, limiteContainers: dto.limiteContainers },
      update: { limiteContainers: dto.limiteContainers },
    });
    await this.auditoria.registrar({
      tabela: 'capacidade_turno_terminal',
      registroId: row.id,
      acao: AcaoAuditoria.UPDATE,
      usuario: actorUserId,
      dadosDepois: row,
    });
    return row;
  }

  async listarCapacidades() {
    return this.prisma.capacidadeTurnoTerminal.findMany({ orderBy: { turno: 'asc' } });
  }
}
