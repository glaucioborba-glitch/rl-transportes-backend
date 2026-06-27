import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AcaoAuditoria,
  Prisma,
  Role,
  StatusAgendamentoTerminal,
  StatusCarga,
  StatusContainer,
  StatusSolicitacao,
  TipoCaminhao,
  TipoUnidade,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PRISMA_SERIALIZABLE_TX } from '../../prisma/transaction-options';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AgendamentosService } from '../../agendamentos/agendamentos.service';
import { RedisService } from '../../redis/redis.service';
import { SecurityEventsService } from '../../security-center/security-events.service';
import { CreateSolicitacaoV2Dto } from './dto/create-solicitacao-v2.dto';
import {
  buildTransportePlaceholderFl,
  resolveAgendamentoFromTipoOperacao,
} from './solicitacao-intent.util';
import { SolicitacaoAnexoStorageService } from './solicitacao-anexo.storage';
import { parseOptionalDateTime, YardAllocationService } from '../../yard-allocation/yard-allocation.service';
import { isValidIso6346 } from '../../common/utils/iso6346';
import { normalizeContainerIso, normalizeCpfDigits, normalizePlate } from '../../common/utils/data-sanitize';
import { isValidPlacaMercosulExtended } from '../../common/utils/mercosul';
import type { CxPortalRequestUser } from '../../cx-portais/types/cx-portal.types';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { buildPessoaAuditMeta } from '../../pessoas-autorizadas/pessoa-context.util';
import { HoldReleaseService } from '../../hold-release/hold-release.service';
import { CreateBloqueioDto } from '../../hold-release/dto/create-bloqueio.dto';

const ANEXO_MAX = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'application/pdf']);

function gerarProtocolo(): string {
  const y = new Date().getFullYear();
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `RL-${y}-${rand}`;
}

@Injectable()
export class SolicitacoesV2Service {
  private readonly logger = new Logger(SolicitacoesV2Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly auditLog: AuditLogService,
    private readonly agendamentos: AgendamentosService,
    private readonly redis: RedisService,
    private readonly securityEvents: SecurityEventsService,
    private readonly storage: SolicitacaoAnexoStorageService,
    private readonly yardAllocation: YardAllocationService,
    private readonly holdRelease: HoldReleaseService,
  ) {}

  /** Rótulo para PDF/relatório sem mudar o enum PostgreSQL (`APROVADO` → `APROVADA`). */
  rotuloStatusV2(status: StatusSolicitacao): string {
    switch (status) {
      case StatusSolicitacao.APROVADO:
        return 'APROVADA';
      case StatusSolicitacao.AGUARDANDO_GATE_IN:
        return 'AGUARDANDO CHECK-IN';
      case StatusSolicitacao.EM_PATIO:
        return 'EM PÁTIO';
      case StatusSolicitacao.AGUARDANDO_GATE_OUT:
        return 'AGUARDANDO GATE-OUT';
      case StatusSolicitacao.REJEITADO:
        return 'REJEITADA';
      case StatusSolicitacao.CONCLUIDO:
        return 'CONCLUIDA';
      case StatusSolicitacao.CANCELADO:
        return 'CANCELADA';
      default:
        return status;
    }
  }

  private assertPlaca(p: string, label: string) {
    const n = normalizePlate(p);
    if (!isValidPlacaMercosulExtended(n)) {
      throw new BadRequestException(`${label}: placa inválida (Mercosul)`);
    }
    return n;
  }

  private validateDto(dto: CreateSolicitacaoV2Dto) {
    const resolved = resolveAgendamentoFromTipoOperacao(dto.tipoOperacao);

    if (resolved.exigeLocalOrigem && !dto.localOrigem?.trim()) {
      throw new BadRequestException('Local de origem é obrigatório para importação/coleta depot.');
    }
    if (resolved.exigeLocalDestino && !dto.localDestino?.trim()) {
      throw new BadRequestException('Local de destino é obrigatório para exportação/entrega depot.');
    }

    if (resolved.exigeTransporteCliente) {
      if (!dto.transporte) {
        throw new BadRequestException('Dados do motorista são obrigatórios para esta operação.');
      }
    } else {
      dto.transporte = buildTransportePlaceholderFl();
    }

    const { transporte, containers } = dto;
    const cpf = normalizeCpfDigits(transporte.cpfMotorista);
    if (cpf.length !== 11) {
      throw new BadRequestException('CPF do motorista inválido');
    }
    dto.transporte.cpfMotorista = cpf;
    dto.transporte.placaCavalo = this.assertPlaca(transporte.placaCavalo, 'Placa cavalo');
    dto.transporte.placaCarreta01 = this.assertPlaca(transporte.placaCarreta01, 'Placa carreta 01');
    if (transporte.tipoCaminhao === TipoCaminhao.LS) {
      if (containers.length !== 1) {
        throw new BadRequestException('Caminhão LS exige exatamente 1 container');
      }
      if (containers[0].ordem !== 1) {
        throw new BadRequestException('Container LS deve ter ordem 1');
      }
      dto.transporte.placaCarreta02 = undefined;
    } else {
      if (containers.length !== 2) {
        throw new BadRequestException('Rodotrem exige 2 containers');
      }
      if (!transporte.placaCarreta02?.trim()) {
        throw new BadRequestException('Placa carreta 02 obrigatória para Rodotrem');
      }
      dto.transporte.placaCarreta02 = this.assertPlaca(
        transporte.placaCarreta02,
        'Placa carreta 02',
      );
      const orders = new Set(containers.map((c) => c.ordem));
      if (!orders.has(1) || !orders.has(2)) {
        throw new BadRequestException('Containers Rodotrem devem ter ordem 1 e 2');
      }
    }
    const isoKeys = containers.map((c) =>
      normalizeContainerIso(c.unidade.trim()).replace(/\s/g, '').toUpperCase(),
    );
    if (new Set(isoKeys).size !== isoKeys.length) {
      throw new BadRequestException('Unidades/containers duplicados na mesma solicitação');
    }
    for (const c of containers) {
      if (c.status === StatusContainer.CHEIO) {
        if (!c.lacre?.trim()) {
          throw new BadRequestException(`Lacre obrigatório para container ordem ${c.ordem} (CHEIO)`);
        }
      }
      if (c.refrigerado && (c.setPoint === undefined || c.setPoint === null || Number.isNaN(c.setPoint))) {
        throw new BadRequestException(`SetPoint obrigatório para reefer ordem ${c.ordem}`);
      }
    }
  }

  async registrarMetricasSegurancaPortal(params: {
    cx: CxPortalRequestUser;
    req: Request;
    dto: CreateSolicitacaoV2Dto;
    solicitacaoId: string;
  }): Promise<void> {
    const { cx, req, dto, solicitacaoId } = params;
    const sinais: string[] = [];
    const fp = (req.headers['x-device-fingerprint'] as string) || '';
    const sid = (req.headers['x-session-id'] as string) || '';
    const ua = req.get('user-agent') || '';

    for (const c of dto.containers) {
      const bk = (c.booking ?? '').trim().toUpperCase();
      if (!bk) continue;
      const bkKey = `v2:booking:${cx.clienteId}:${bk}`;
      try {
        const hits = await this.redis.incr(bkKey);
        if (hits === 1) await this.redis.expire(bkKey, 600);
        if (hits >= 4) {
          sinais.push('BOOKING_REPETIDO');
          this.securityEvents.emit({ type: 'CRITICAL_EVENT', tipo: 'SOLICITACAO_V2_RISCO_ELEVADO', solicitacaoId });
          this.securityEvents.emit({ type: 'CRITICAL_EVENT', tipo: 'BOOKING_REPETIDO', solicitacaoId });
          await this.prisma.securityAlert.create({
            data: {
              userId: cx.sub,
              clienteId: cx.clienteId ?? undefined,
              tipo: 'booking_repetido_curto',
              fingerprint: fp || undefined,
              rota: 'POST v2/solicitacoes',
              metodo: 'POST',
              contexto: { booking: bk, hits, solicitacaoId } as object,
              risco: 48,
            },
          });
        }
      } catch {
        /* ignore */
      }
    }

    for (const c of dto.containers) {
      const iso = normalizeContainerIso(c.unidade.trim()).replace(/\s/g, '').toUpperCase();
      if (!iso) continue;
      const isoKey = `v2:iso:${cx.clienteId}:${iso}`;
      try {
        const hits = await this.redis.incr(isoKey);
        if (hits === 1) await this.redis.expire(isoKey, 900);
        if (hits >= 3) {
          sinais.push('CONTAINER_ISO_REPETIDO_CURTO');
          this.securityEvents.emit({ type: 'CRITICAL_EVENT', tipo: 'SOLICITACAO_V2_RISCO_ELEVADO', solicitacaoId });
          this.securityEvents.emit({ type: 'CRITICAL_EVENT', tipo: 'CONTAINER_ISO_REPETIDO_CURTO', solicitacaoId });
          await this.prisma.securityAlert.create({
            data: {
              userId: cx.sub,
              clienteId: cx.clienteId ?? undefined,
              tipo: 'container_iso_repetido_curto',
              fingerprint: fp || undefined,
              rota: 'POST v2/solicitacoes',
              metodo: 'POST',
              contexto: { iso, hits, solicitacaoId } as object,
              risco: 42,
            },
          });
        }
      } catch {
        /* ignore */
      }
    }

    for (const c of dto.containers) {
      if (c.refrigerado && c.setPoint !== undefined && (c.setPoint < -30 || c.setPoint > 30)) {
        sinais.push('REEFER_SETPOINT_INCOERENTE');
        this.securityEvents.emit({ type: 'CRITICAL_EVENT', tipo: 'SOLICITACAO_V2_RISCO_ELEVADO', solicitacaoId });
        this.securityEvents.emit({ type: 'CRITICAL_EVENT', tipo: 'REEFER_SETPOINT_ANOMALO', solicitacaoId });
        await this.prisma.securityAlert.create({
          data: {
            userId: cx.sub,
            clienteId: cx.clienteId ?? undefined,
            tipo: 'reefer_setpoint_anomalo',
            fingerprint: fp || undefined,
            contexto: { setPoint: c.setPoint, ordem: c.ordem, solicitacaoId } as object,
            risco: 35,
          },
        });
      }
    }

    const bkVals = dto.containers
      .map((c) => (c.booking ?? '').trim().toUpperCase())
      .filter(Boolean);
    if (bkVals.length > 0 && new Set(bkVals).size !== bkVals.length) {
      sinais.push('BOOKING_DUPLICADO_NO_FORMULARIO');
    }

    this.securityEvents.emitRiskChanged({
      portalSub: cx.sub,
      sessionId: sid,
      userAgent: ua,
      solicitacaoId,
      fingerprint: fp,
    });

    this.securityEvents.emitSolicitacaoV2RiscoClassificado({
      solicitacaoId,
      userId: cx.sub,
      clienteId: cx.clienteId ?? null,
      sinais: [...new Set(sinais)],
      device: {
        fingerprint: fp || null,
        sessionId: sid || null,
        userAgent: ua,
        ip: req.ip ?? null,
      },
    });
  }

  /**
   * Limite de criações por hora (sessão portal) — bloqueia antes da transação.
   */
  private async assertPreCriacaoPortalPermitida(cx: CxPortalRequestUser, req: Request): Promise<void> {
    const hourKey = `v2:solcnt:${cx.sub}:${Math.floor(Date.now() / 3_600_000)}`;
    try {
      const n = await this.redis.incr(hourKey);
      if (n === 1) await this.redis.expire(hourKey, 7200);
      if (n > 15) {
        await this.redis.decr(hourKey);
        const fp = (req.headers['x-device-fingerprint'] as string) || '';
        this.securityEvents.emit({ type: 'CRITICAL_EVENT', tipo: 'SOLICITACAO_V2_RISCO_ELEVADO' });
        await this.prisma.securityAlert.create({
          data: {
            userId: cx.sub,
            clienteId: cx.clienteId ?? undefined,
            tipo: 'portal_solicitacoes_velocidade',
            ip: req.ip ?? undefined,
            fingerprint: fp || undefined,
            rota: 'POST /v2/solicitacoes',
            metodo: 'POST',
            contexto: { countHorario: n, bloqueado: true } as object,
            risco: 72,
          },
        });
        throw new ForbiddenException(
          'Criação bloqueada por política de segurança (volume elevado). Contate o suporte.',
        );
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      this.logger.warn(`Redis pré-check v2: ${(e as Error).message}`);
    }
  }

  private async persistAnexoArquivo(
    solicitacaoId: string,
    file: Express.Multer.File,
    usuarioId: string,
    tx?: Prisma.TransactionClient,
    solicitacaoAuditMeta?: { clienteOwned?: boolean; clienteSub?: string },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Arquivo vazio');
    if (file.size > ANEXO_MAX) throw new BadRequestException('Arquivo excede 5MB');
    const mime = file.mimetype.toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('Somente JPG ou PDF');
    }

    const { url } = await this.storage.persist({
      solicitacaoId,
      buffer: file.buffer,
      mimeType: mime,
      originalName: file.originalname || 'anexo',
    });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const db = tx ?? this.prisma;

    const row = await db.solicitacaoAnexo.create({
      data: {
        solicitacaoId,
        filename: (file.originalname ?? 'arquivo').slice(0, 250),
        mimeType: mime,
        size: file.size,
        urlS3: url,
        expiresAt,
      },
    });

    await this.auditoria.registrar(
      {
        tabela: 'solicitacao_anexos',
        registroId: row.id,
        acao: AcaoAuditoria.INSERT,
        usuario: usuarioId,
        solicitacaoId,
        dadosDepois: {
          filename: row.filename,
          size: row.size,
          portalCliente: solicitacaoAuditMeta?.clienteOwned ?? false,
        },
      },
      tx,
    );

    return row;
  }

  async criarPortal(
    dto: CreateSolicitacaoV2Dto,
    cx: CxPortalRequestUser,
    req: Request,
    opts?: { anexos?: Express.Multer.File[] },
  ) {
    if (cx.portalPapel !== 'CLIENTE' || !cx.clienteId) {
      throw new ForbiddenException('Somente cliente autenticado no portal pode criar solicitação v2');
    }
    this.validateDto(dto);
    const transporte = dto.transporte!;
    if (opts?.anexos !== undefined && !opts.anexos.length) {
      throw new BadRequestException('Anexo obrigatório: envie ao menos um arquivo (JPG/PDF).');
    }
    await this.assertPreCriacaoPortalPermitida(cx, req);

    const pessoaMeta = buildPessoaAuditMeta(cx, req, 'criarSolicitacao');
    if (cx.pessoaAutorizada) {
      dto.solicitante = {
        nome: cx.pessoaAutorizada.nome,
        email: cx.pessoaAutorizada.email,
        telefone: cx.pessoaAutorizada.telefone ?? dto.solicitante.telefone,
      };
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: cx.clienteId, deletedAt: null },
    });
    if (!cliente) {
      throw new BadRequestException('Cliente não encontrado');
    }
    // Faturamento: sempre o tenant principal (cx.clienteId), nunca o CNPJ da transportadora.
    const clienteIdFaturamento = cx.clienteId;

    const dataRef = new Date(`${dto.agendamento.dataRef}T00:00:00.000Z`);
    if (Number.isNaN(dataRef.getTime())) {
      throw new BadRequestException('Data de agendamento inválida');
    }

    const agendamentoIntent = resolveAgendamentoFromTipoOperacao(dto.tipoOperacao);
    const containersComIso = dto.containers
      .map((c) => {
        const unidadeNorm = normalizeContainerIso(c.unidade.trim());
        const iso = unidadeNorm.replace(/\s/g, '');
        return { container: c, iso, unidadeNorm };
      })
      .filter((row) => isValidIso6346(row.iso));

    if (containersComIso.length) {
      await this.agendamentos.assertCapacidadeTurno(
        dto.agendamento.dataRef,
        dto.agendamento.turno,
        containersComIso.length,
      );
    }

    const previsaoRetirada = parseOptionalDateTime(dto.previsaoRetirada);
    const bookingDeadline = parseOptionalDateTime(dto.bookingDeadline);

    for (let attempt = 0; attempt < 5; attempt++) {
      const protocolo = gerarProtocolo();
      try {
        const agendamentoIdsPos: string[] = [];
        const result = await this.prisma.$transaction(
          async (tx) => {
            const sol = await tx.solicitacao.create({
              data: {
                protocolo,
                clienteId: clienteIdFaturamento!,
                status: StatusSolicitacao.PENDENTE,
                tipoOperacao: dto.tipoOperacao,
                previsaoRetirada,
                bookingDeadline,
              },
            });

            await tx.transporteSolicitacao.create({
              data: {
                solicitacaoId: sol.id,
                nomeMotorista: transporte.nomeMotorista.trim(),
                cpfMotorista: transporte.cpfMotorista,
                tipoCaminhao: transporte.tipoCaminhao,
                placaCavalo: transporte.placaCavalo,
                placaCarreta01: transporte.placaCarreta01,
                placaCarreta02: transporte.placaCarreta02 ?? null,
              },
            });

            for (const c of dto.containers) {
              const unidadeNorm = normalizeContainerIso(c.unidade.trim());
              await tx.containerSolicitacao.create({
                data: {
                  solicitacaoId: sol.id,
                  unidade: unidadeNorm,
                  booking: (c.booking ?? '').trim(),
                  processo: (c.processo ?? '').trim(),
                  tamanho: c.tamanho.trim(),
                  tipo: c.tipo.trim(),
                  status: c.status,
                  lacre: c.lacre?.trim() || null,
                  refrigerado: c.refrigerado,
                  setPoint: c.setPoint ?? null,
                  reeferId: null,
                  ordem: c.ordem,
                },
              });
              const iso = unidadeNorm.replace(/\s/g, '');
              if (isValidIso6346(iso)) {
                try {
                  await tx.unidade.create({
                    data: {
                      solicitacaoId: sol.id,
                      numeroIso: iso,
                      tipo: TipoUnidade.IMPORT,
                    },
                  });
                } catch (e) {
                  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                    throw new ConflictException(
                      'Número ISO já vinculado a outra operação. Ajuste o campo Unidade.',
                    );
                  }
                  throw e;
                }
              }
            }

            await tx.agendamentoSolicitacao.create({
              data: {
                solicitacaoId: sol.id,
                dataRef,
                turno: dto.agendamento.turno,
                atendimentoEspecial: dto.agendamento.atendimentoEspecial,
                atendimentoEspecialTexto: dto.agendamento.atendimentoEspecialTexto?.trim() || null,
              },
            });

            await tx.solicitanteContato.create({
              data: {
                solicitacaoId: sol.id,
                nome: dto.solicitante.nome.trim(),
                telefone: dto.solicitante.telefone.replace(/\D/g, ''),
                email: dto.solicitante.email.trim().toLowerCase(),
              },
            });

            if (opts?.anexos?.length) {
              for (const f of opts.anexos) {
                await this.persistAnexoArquivo(sol.id, f, cx.sub, tx, {
                  clienteOwned: true,
                  clienteSub: cx.sub,
                });
              }
            }

            for (const { iso, container } of containersComIso) {
              const agRow = await this.agendamentos.criarNaTransacao(
                tx,
                {
                  clienteId: clienteIdFaturamento!,
                  solicitacaoId: sol.id,
                  numeroIso: iso,
                  dataRef: dto.agendamento.dataRef,
                  turno: dto.agendamento.turno,
                  tipoOperacao: agendamentoIntent.tipoOperacao,
                  statusCarga: container.status as StatusCarga,
                  modalidadeTransporte: agendamentoIntent.modalidadeTransporte,
                  localOrigem: dto.localOrigem?.trim() || undefined,
                  localDestino: dto.localDestino?.trim() || undefined,
                  status: StatusAgendamentoTerminal.PENDENTE,
                },
                cx.sub,
              );
              agendamentoIdsPos.push(agRow.id);
            }

            await this.yardAllocation.applyGiroEstimado(sol.id, { tx });

            const full = await tx.solicitacao.findUniqueOrThrow({
              where: { id: sol.id },
              include: {
                transporteSolicitacao: true,
                containersSolicitacao: true,
                agendamentoSolicitacao: true,
                solicitanteContato: true,
                unidades: true,
                anexosSolicitacao: true,
              },
            });

            await this.auditoria.registrar(
              {
                tabela: 'solicitacoes',
                registroId: sol.id,
                acao: AcaoAuditoria.INSERT,
                usuario: cx.sub,
                solicitacaoId: sol.id,
                dadosDepois: {
                  v2: true,
                  protocolo,
                  tipoOperacao: dto.tipoOperacao,
                  clienteId: cx.clienteId,
                  ...(pessoaMeta
                    ? {
                        pessoaResponsavel: {
                          id: cx.pessoaAutorizada!.id,
                          nome: cx.pessoaAutorizada!.nome,
                          email: cx.pessoaAutorizada!.email,
                          telefone: cx.pessoaAutorizada!.telefone,
                        },
                        usuario: pessoaMeta,
                      }
                    : {}),
                },
                ip: req.ip,
                userAgent: req.get('user-agent') ?? undefined,
              },
              tx,
            );

            return full;
          },
          PRISMA_SERIALIZABLE_TX,
        );

        for (const agId of agendamentoIdsPos) {
          await this.agendamentos.posCriacao(agId, cx.sub);
        }

        void this.registrarMetricasSegurancaPortal({ cx, req, dto, solicitacaoId: result.id });

        this.securityEvents.emit({
          type: 'CRITICAL_EVENT',
          tipo: pessoaMeta ? 'SOLICITACAO_CRIADA_POR_PESSOA' : 'SOLICITACAO_V2_CRIADA',
          solicitacaoId: result.id,
          contexto: pessoaMeta ? (pessoaMeta as Record<string, unknown>) : undefined,
        });
        if (opts?.anexos?.length) {
          for (let i = 0; i < opts.anexos.length; i++) {
            this.securityEvents.emit({
              type: 'CRITICAL_EVENT',
              tipo: 'SOLICITACAO_V2_ANEXO_ADICIONADO',
              solicitacaoId: result.id,
            });
          }
        }

        return result;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const target = (e.meta?.target as string[])?.join?.(',') ?? '';
          if (target.includes('protocolo')) continue;
        }
        throw e;
      }
    }
    throw new ConflictException('Não foi possível gerar protocolo único');
  }

  async anexarPortal(
    solicitacaoId: string,
    cx: CxPortalRequestUser,
    file: Express.Multer.File,
  ) {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id: solicitacaoId, deletedAt: null, clienteId: cx.clienteId! },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    if (cx.portalPapel !== 'CLIENTE' || !cx.clienteId) throw new ForbiddenException();

    const row = await this.persistAnexoArquivo(solicitacaoId, file, cx.sub, undefined, {
      clienteOwned: true,
      clienteSub: cx.sub,
    });

    this.securityEvents.emit({
      type: 'CRITICAL_EVENT',
      tipo: 'SOLICITACAO_V2_ANEXO_ADICIONADO',
      solicitacaoId,
    });

    return row;
  }

  async anexarStaff(solicitacaoId: string, user: AuthUser, file: Express.Multer.File) {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id: solicitacaoId, deletedAt: null },
      include: { transporteSolicitacao: true },
    });
    if (!sol?.transporteSolicitacao) throw new NotFoundException('Solicitação v2 não encontrada');
    const row = await this.persistAnexoArquivo(solicitacaoId, file, user.id, undefined, {
      clienteOwned: false,
    });
    this.securityEvents.emit({
      type: 'CRITICAL_EVENT',
      tipo: 'SOLICITACAO_V2_ANEXO_ADICIONADO',
      solicitacaoId,
    });
    return row;
  }

  async obterMetricasResumoStaff() {
    const since = new Date(Date.now() - 30 * 86400000);
    const v2Where: Prisma.SolicitacaoWhereInput = {
      deletedAt: null,
      transporteSolicitacao: { isNot: null },
      createdAt: { gte: since },
    };
    const [total, ls, rodotrem, cheio, vazio, reefer] = await Promise.all([
      this.prisma.solicitacao.count({ where: v2Where }),
      this.prisma.solicitacao.count({
        where: {
          ...v2Where,
          transporteSolicitacao: { is: { tipoCaminhao: TipoCaminhao.LS } },
        },
      }),
      this.prisma.solicitacao.count({
        where: {
          ...v2Where,
          transporteSolicitacao: { is: { tipoCaminhao: TipoCaminhao.RODOTREM } },
        },
      }),
      this.prisma.containerSolicitacao.count({
        where: { status: StatusContainer.CHEIO, solicitacao: v2Where },
      }),
      this.prisma.containerSolicitacao.count({
        where: { status: StatusContainer.VAZIO, solicitacao: v2Where },
      }),
      this.prisma.containerSolicitacao.count({
        where: { refrigerado: true, solicitacao: v2Where },
      }),
    ]);

    const rows = await this.prisma.solicitacao.findMany({
      where: v2Where,
      select: { createdAt: true },
    });
    const porDiaMap = new Map<string, number>();
    for (const r of rows) {
      const k = r.createdAt.toISOString().slice(0, 10);
      porDiaMap.set(k, (porDiaMap.get(k) ?? 0) + 1);
    }
    const criacoesPorDia = [...porDiaMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 31)
      .map(([dataRef, quantidade]) => ({ dataRef, quantidade }));

    return {
      periodoDias: 30,
      desde: since.toISOString(),
      totalSolicitacoesV2: total,
      porTipoCaminhao: { LS: ls, RODOTREM: rodotrem },
      containers: { cheio, vazio, refrigerados: reefer },
      criacoesPorDia,
    };
  }

  async listarStaff(query: {
    page?: number;
    limit?: number;
    status?: StatusSolicitacao;
    clienteId?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.SolicitacaoWhereInput = {
      deletedAt: null,
      transporteSolicitacao: { isNot: null },
      ...(query.status ? { status: query.status } : {}),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.solicitacao.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true } },
          transporteSolicitacao: true,
          containersSolicitacao: true,
          agendamentoSolicitacao: true,
          solicitanteContato: true,
          anexosSolicitacao: true,
        },
      }),
      this.prisma.solicitacao.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  private unwrapAuditPayload(json: unknown): Record<string, unknown> | null {
    if (json == null || typeof json !== 'object') return null;
    const o = json as Record<string, unknown>;
    const rec = o.record;
    if (rec != null && typeof rec === 'object' && !Array.isArray(rec)) {
      return rec as Record<string, unknown>;
    }
    return o;
  }

  private montarTimelineStaff(
    s: { id: string; createdAt: Date; protocolo: string; status: StatusSolicitacao },
    anexos: Array<{ id: string; filename: string; createdAt: Date }>,
    audits: Array<{
      id: string;
      tabela: string;
      acao: AcaoAuditoria;
      createdAt: Date;
      dadosAntes: unknown;
      dadosDepois: unknown;
    }>,
    securityAlerts: Array<{ id: string; tipo: string; createdAt: Date; risco: number | null }>,
  ) {
    type Tl = {
      id: string;
      tipo:
        | 'criacao'
        | 'anexo'
        | 'delta'
        | 'aprovacao'
        | 'rejeicao'
        | 'alerta'
        | 'gate_in'
        | 'gate_out';
      titulo: string;
      subtitulo?: string;
      createdAt: string;
      meta?: Record<string, unknown>;
    };
    const items: Tl[] = [];
    items.push({
      id: `criacao-${s.id}`,
      tipo: 'criacao',
      titulo: 'Solicitação criada',
      subtitulo: s.protocolo,
      createdAt: s.createdAt.toISOString(),
    });

    const anexSorted = [...anexos].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const ax of anexSorted) {
      items.push({
        id: `anexo-${ax.id}`,
        tipo: 'anexo',
        titulo: 'Documento anexado',
        subtitulo: ax.filename,
        createdAt: ax.createdAt.toISOString(),
        meta: { anexoId: ax.id },
      });
    }

    const auditsSorted = [...audits].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const au of auditsSorted) {
      const dep = this.unwrapAuditPayload(au.dadosDepois);
      const ant = this.unwrapAuditPayload(au.dadosAntes);
      const deltas = dep?.deltas as Array<{ campo: string; antes: unknown; depois: unknown }> | undefined;
      if (deltas?.length) {
        for (const d of deltas) {
          let tipo: Tl['tipo'] = 'delta';
          if (d.campo === 'status') {
            if (
              d.depois === StatusSolicitacao.APROVADO ||
              d.depois === StatusSolicitacao.AGUARDANDO_GATE_IN
            )
              tipo = 'aprovacao';
            else if (d.depois === StatusSolicitacao.REJEITADO) tipo = 'rejeicao';
          }
          const titulo =
            tipo === 'aprovacao'
              ? 'Aprovação (delta)'
              : tipo === 'rejeicao'
                ? 'Rejeição (delta)'
                : d.campo === 'status'
                  ? 'Status (delta)'
                  : `Campo ${d.campo} (delta)`;
          items.push({
            id: `${au.id}-${d.campo}`,
            tipo,
            titulo,
            subtitulo: `${JSON.stringify(d.antes)} → ${JSON.stringify(d.depois)}`,
            createdAt: au.createdAt.toISOString(),
            meta: { auditoriaId: au.id, delta: true },
          });
        }
        continue;
      }
      if (au.acao === AcaoAuditoria.INSERT && au.tabela === 'solicitacao_anexos') {
        continue;
      }
      if (
        au.acao === AcaoAuditoria.UPDATE &&
        au.tabela === 'solicitacoes' &&
        dep &&
        ant &&
        dep.status !== ant.status
      ) {
        let tipo: Tl['tipo'] = 'delta';
        if (
          dep.status === StatusSolicitacao.APROVADO ||
          dep.status === StatusSolicitacao.AGUARDANDO_GATE_IN
        )
          tipo = 'aprovacao';
        if (dep.status === StatusSolicitacao.REJEITADO) tipo = 'rejeicao';
        items.push({
          id: `${au.id}-status`,
          tipo,
          titulo:
            tipo === 'aprovacao'
              ? 'Aprovação'
              : tipo === 'rejeicao'
                ? 'Rejeição'
                : 'Atualização de status',
          subtitulo: `${String(ant.status)} → ${String(dep.status)}`,
          createdAt: au.createdAt.toISOString(),
        });
      }
    }

    const secSorted = [...securityAlerts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const al of secSorted) {
      items.push({
        id: `sec-${al.id}`,
        tipo: 'alerta',
        titulo: 'Alerta de segurança',
        subtitulo: al.tipo,
        createdAt: al.createdAt.toISOString(),
        meta: { risco: al.risco },
      });
    }

    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return items;
  }

  async obterDetalheStaff(id: string) {
    const s = await this.prisma.solicitacao.findFirst({
      where: { id, deletedAt: null, transporteSolicitacao: { isNot: null } },
      include: {
        cliente: true,
        transporteSolicitacao: true,
        containersSolicitacao: { orderBy: { ordem: 'asc' } },
        agendamentoSolicitacao: true,
        solicitanteContato: true,
        anexosSolicitacao: { orderBy: { createdAt: 'asc' } },
        unidades: true,
        portaria: true,
        gateCheckIns: {
          orderBy: { dataHora: 'asc' },
          take: 20,
          include: {
            checkOut: {
              include: {
                operador: { select: { id: true, email: true } },
              },
            },
            operador: { select: { id: true, email: true } },
          },
        },
      },
    });
    if (!s) return null;
    const [auditsSol, auditsAnexosAll, secAlertsSolicitacao, secAlertsCliente] = await Promise.all([
      this.prisma.auditoria.findMany({
        where: { tabela: 'solicitacoes', registroId: id },
        orderBy: { createdAt: 'asc' },
        take: 120,
      }),
      this.prisma.auditoria.findMany({
        where: { tabela: 'solicitacao_anexos' },
        orderBy: { createdAt: 'asc' },
        take: 400,
      }),
      this.prisma.securityAlert.findMany({
        where: {
          clienteId: s.clienteId,
          contexto: { path: ['solicitacaoId'], equals: id },
        },
        orderBy: { createdAt: 'asc' },
        take: 60,
      }),
      this.prisma.securityAlert.findMany({
        where: { clienteId: s.clienteId },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ]);
    const auditsAnexos = auditsAnexosAll.filter((a) => {
      const dep = this.unwrapAuditPayload(a.dadosDepois);
      return dep?.solicitacaoId === id;
    });
    const audits = [...auditsSol, ...auditsAnexos].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const secMap = new Map<string, (typeof secAlertsSolicitacao)[0]>();
    for (const a of [...secAlertsSolicitacao, ...secAlertsCliente]) {
      secMap.set(a.id, a);
    }
    const securityAlerts = [...secMap.values()].slice(0, 40);
    const riscosNum = securityAlerts
      .map((a) => (a.risco != null ? Number(a.risco) : null))
      .filter((n): n is number => n != null && !Number.isNaN(n));
    const resumoRisco = {
      totalAlertas: securityAlerts.length,
      riscoMax: riscosNum.length ? Math.max(...riscosNum) : null,
    };
    const timeline = this.montarTimelineStaff(
      {
        id: s.id,
        createdAt: s.createdAt,
        protocolo: s.protocolo,
        status: s.status,
      },
      s.anexosSolicitacao,
      audits,
      securityAlerts.map((a) => ({
        id: a.id,
        tipo: a.tipo,
        createdAt: a.createdAt,
        risco: a.risco != null ? Number(a.risco) : null,
      })),
    );
    const gateTimeline = s.gateCheckIns.flatMap((gi) => {
      const rows: (typeof timeline)[number][] = [];
      rows.push({
        id: `gate-in-${gi.id}`,
        tipo: 'gate_in',
        titulo: 'Gate — Check-in',
        subtitulo: `${gi.placaCavalo} · ${gi.operador.email}`,
        createdAt: gi.dataHora.toISOString(),
      });
      if (gi.checkOut) {
        rows.push({
          id: `gate-out-${gi.checkOut.id}`,
          tipo: 'gate_out',
          titulo: 'Gate — Check-out',
          subtitulo: gi.checkOut.operador.email,
          createdAt: gi.checkOut.dataHora.toISOString(),
        });
      }
      return rows;
    });
    const timelineMerged = [...timeline, ...gateTimeline].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const bloqueiosAtivos = await this.holdRelease.listAtivosBySolicitacao(id);
    return {
      solicitacao: s,
      auditoria: audits,
      securityAlerts,
      timeline: timelineMerged,
      statusV2Label: this.rotuloStatusV2(s.status),
      resumoRisco,
      bloqueiosAtivos,
    };
  }

  async aplicarBloqueioStaff(solicitacaoId: string, user: AuthUser, dto: CreateBloqueioDto) {
    if (user.role !== Role.ADMIN && user.role !== Role.GERENTE) {
      throw new ForbiddenException('Apenas admin/gerente pode aplicar bloqueio manual.');
    }
    return this.holdRelease.aplicarBloqueio({
      solicitacaoId,
      tipo: dto.tipo,
      motivo: dto.motivo,
      bloqueadoPorId: user.id,
    });
  }

  async liberarBloqueioStaff(solicitacaoId: string, bloqueioId: string, user: AuthUser) {
    if (user.role !== Role.ADMIN && user.role !== Role.GERENTE) {
      throw new ForbiddenException('Apenas admin/gerente pode liberar bloqueio.');
    }
    const row = await this.prisma.bloqueioContainer.findFirst({
      where: { id: bloqueioId, solicitacaoId },
    });
    if (!row) throw new NotFoundException('Bloqueio não encontrado nesta solicitação');
    return this.holdRelease.liberarBloqueio(bloqueioId, user.id);
  }

  async aprovarStaff(id: string, user: AuthUser) {
    const s = await this.prisma.solicitacao.findFirst({
      where: { id, deletedAt: null },
      include: { anexosSolicitacao: true, transporteSolicitacao: true },
    });
    if (!s?.transporteSolicitacao) throw new NotFoundException('Solicitação v2 não encontrada');
    if (s.status !== StatusSolicitacao.PENDENTE && s.status !== StatusSolicitacao.EM_ANALISE) {
      throw new BadRequestException('Somente pendente ou em análise pode ser aprovada');
    }
    if (!s.anexosSolicitacao.length) {
      throw new BadRequestException('Anexos obrigatórios — nenhum arquivo registrado');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.solicitacao.update({
        where: { id },
        data: { status: StatusSolicitacao.AGUARDANDO_GATE_IN },
        include: {
          transporteSolicitacao: true,
          containersSolicitacao: true,
          agendamentoSolicitacao: true,
          solicitanteContato: true,
          anexosSolicitacao: true,
        },
      });
      await this.auditoria.registrar(
        {
          tabela: 'solicitacoes',
          registroId: id,
          acao: AcaoAuditoria.UPDATE,
          usuario: user.id,
          solicitacaoId: id,
          dadosAntes: { status: s.status },
          dadosDepois: { status: u.status, staffAprovacao: true },
          deltas: [{ campo: 'status', antes: s.status, depois: u.status }],
        },
        tx,
      );
      return u;
    });
    this.securityEvents.emit({
      type: 'CRITICAL_EVENT',
      tipo: 'SOLICITACAO_V2_APROVADA',
      solicitacaoId: id,
    });
    return updated;
  }

  async rejeitarStaff(id: string, user: AuthUser, motivo?: string) {
    const s = await this.prisma.solicitacao.findFirst({
      where: { id, deletedAt: null },
      include: { transporteSolicitacao: true },
    });
    if (!s?.transporteSolicitacao) throw new NotFoundException('Solicitação v2 não encontrada');
    if (s.status !== StatusSolicitacao.PENDENTE && s.status !== StatusSolicitacao.EM_ANALISE) {
      throw new BadRequestException('Somente pendente ou em análise pode ser rejeitada');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.solicitacao.update({
        where: { id },
        data: { status: StatusSolicitacao.REJEITADO },
        include: {
          transporteSolicitacao: true,
          containersSolicitacao: true,
          anexosSolicitacao: true,
        },
      });
      await this.auditoria.registrar(
        {
          tabela: 'solicitacoes',
          registroId: id,
          acao: AcaoAuditoria.UPDATE,
          usuario: user.id,
          solicitacaoId: id,
          dadosAntes: { status: s.status },
          dadosDepois: { status: u.status, motivo: motivo ?? null },
          deltas: [{ campo: 'status', antes: s.status, depois: u.status }],
        },
        tx,
      );
      return u;
    });
    this.securityEvents.emit({
      type: 'CRITICAL_EVENT',
      tipo: 'SOLICITACAO_V2_REJEITADA',
      solicitacaoId: id,
    });
    return updated;
  }

  async removerAnexoStaff(anexoId: string, user: AuthUser) {
    const row = await this.prisma.solicitacaoAnexo.findUnique({ where: { id: anexoId } });
    if (!row) throw new NotFoundException('Anexo não encontrado');
    this.storage.removeLocalIfApplicable(row.urlS3);
    await this.prisma.solicitacaoAnexo.delete({ where: { id: anexoId } });
    await this.auditoria.registrar({
      tabela: 'solicitacao_anexos',
      registroId: anexoId,
      acao: AcaoAuditoria.DELETE,
      usuario: user.id,
      solicitacaoId: row.solicitacaoId,
      dadosAntes: { filename: row.filename, solicitacaoId: row.solicitacaoId },
    });
    return { removed: true };
  }

  async historicoAlteracoesStaff(id: string, user: AuthUser) {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!sol) throw new NotFoundException('Solicitação v2 não encontrada');
    const logs = await this.auditLog.listBySolicitacao(id, { staff: user });
    return { solicitacaoId: id, items: this.auditLog.serializeForUi(logs) };
  }
}
