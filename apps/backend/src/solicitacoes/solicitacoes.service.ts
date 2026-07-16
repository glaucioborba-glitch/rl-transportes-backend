import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma, Role, StatusSolicitacao } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { randomBytes } from 'crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  registrarLeituraSensivel,
  registrarTentativaForaDeEscopo,
  registrarViolacaoSequenciaOperacional,
} from '../common/security/scope-audit.util';
import { PRISMA_SERIALIZABLE_TX } from '../prisma/transaction-options';
import { ServicosLogisticosService } from '../servicos-logisticos/servicos-logisticos.service';
import { SolicitacaoPaginationDto } from '../common/dtos/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AddUnidadeSolicitacaoDto } from './dto/add-unidade-solicitacao.dto';
import { CreateGateDto } from './dto/create-gate.dto';
import { CreatePatioDto } from './dto/create-patio.dto';
import { CreatePortariaDto } from './dto/create-portaria.dto';
import { CreateSaidaDto } from './dto/create-saida.dto';
import { CreateSolicitacaoDto } from './dto/create-solicitacao.dto';
import { UpdateSolicitacaoDto } from './dto/update-solicitacao.dto';

/** Transições válidas — FL armazenagem alinhado a: solicitado → análise → aprovado → execução → concluído. */
export const VALID_STATUS_TRANSITIONS: Record<StatusSolicitacao, StatusSolicitacao[]> = {
  [StatusSolicitacao.PENDENTE]: [
    StatusSolicitacao.EM_ANALISE,
    StatusSolicitacao.APROVADO,
    StatusSolicitacao.REJEITADO,
    StatusSolicitacao.CANCELADO,
  ],
  [StatusSolicitacao.EM_ANALISE]: [
    StatusSolicitacao.APROVADO,
    StatusSolicitacao.REJEITADO,
    StatusSolicitacao.CANCELADO,
  ],
  [StatusSolicitacao.APROVADO]: [
    StatusSolicitacao.EM_EXECUCAO,
    StatusSolicitacao.CONCLUIDO,
    StatusSolicitacao.REJEITADO,
    StatusSolicitacao.CANCELADO,
  ],
  [StatusSolicitacao.EM_EXECUCAO]: [
    StatusSolicitacao.CONCLUIDO,
    StatusSolicitacao.REJEITADO,
    StatusSolicitacao.CANCELADO,
  ],
  [StatusSolicitacao.AGUARDANDO_GATE_IN]: [
    StatusSolicitacao.EM_PATIO,
    StatusSolicitacao.CANCELADO,
  ],
  [StatusSolicitacao.EM_PATIO]: [
    StatusSolicitacao.AGUARDANDO_GATE_OUT,
    StatusSolicitacao.CONCLUIDO,
    StatusSolicitacao.CANCELADO,
  ],
  [StatusSolicitacao.AGUARDANDO_GATE_OUT]: [
    StatusSolicitacao.CONCLUIDO,
    StatusSolicitacao.CANCELADO,
  ],
  [StatusSolicitacao.CONCLUIDO]: [],
  [StatusSolicitacao.REJEITADO]: [],
  [StatusSolicitacao.CANCELADO]: [],
  [StatusSolicitacao.CANCELADO_CLIENTE]: [],
};

function gerarProtocolo(): string {
  const y = new Date().getFullYear();
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `RL-${y}-${rand}`;
}

const SOLICITACAO_ORDER_BY = new Set(['createdAt', 'protocolo', 'status']);

@Injectable()
export class SolicitacoesService {
  private readonly logger = new Logger(SolicitacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly servicosLogisticos: ServicosLogisticosService,
  ) {}

  async create(dto: CreateSolicitacaoDto, actorUserId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: dto.clienteId, deletedAt: null },
    });
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const protocolo = gerarProtocolo();
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const sol = await tx.solicitacao.create({
              data: {
                protocolo,
                clienteId: dto.clienteId,
                status: StatusSolicitacao.PENDENTE,
                tipoFluxo: dto.tipoFluxo ?? undefined,
                servicosAdicionais:
                  dto.servicosAdicionais?.length && dto.servicosAdicionais.length > 0
                    ? (dto.servicosAdicionais as Prisma.InputJsonValue)
                    : undefined,
              },
            });
            await tx.unidade.createMany({
              data: dto.unidades.map((u) => ({
                solicitacaoId: sol.id,
                numeroIso: u.numeroIso,
                tipo: u.tipo,
              })),
            });
            const full = await tx.solicitacao.findUniqueOrThrow({
              where: { id: sol.id },
              include: { unidades: true, cliente: true },
            });
            await this.auditoria.registrar(
              {
                tabela: 'solicitacoes',
                registroId: sol.id,
                acao: AcaoAuditoria.INSERT,
                usuario: actorUserId,
                dadosDepois: full,
              },
              tx,
            );
            this.logger.log(`Solicitação criada protocolo=${protocolo} id=${sol.id}`);
            return full;
          },
          PRISMA_SERIALIZABLE_TX,
        );
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException('Não foi possível gerar protocolo único');
  }

  async addContainer(dto: AddUnidadeSolicitacaoDto, actorUserId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const solicitacao = await tx.solicitacao.findFirst({
          where: { id: dto.solicitacaoId, deletedAt: null },
        });
        if (!solicitacao) {
          throw new NotFoundException('Solicitação não encontrada');
        }
        const dup = await tx.unidade.findUnique({
          where: { numeroIso: dto.numeroIso },
        });
        if (dup) {
          if (dup.solicitacaoId !== dto.solicitacaoId) {
            throw new ConflictException(
              'Número ISO já vinculado a outra solicitação; o contêiner pertence a um único cliente/operação.',
            );
          }
          throw new ConflictException('Número ISO já cadastrado nesta solicitação.');
        }
        const unit = await tx.unidade.create({
          data: {
            solicitacaoId: dto.solicitacaoId,
            numeroIso: dto.numeroIso,
            tipo: dto.tipo,
          },
        });
        await this.auditoria.registrar(
          {
            tabela: 'unidades_solicitacao',
            registroId: unit.id,
            acao: AcaoAuditoria.INSERT,
            usuario: actorUserId,
            dadosDepois: unit,
          },
          tx,
        );
        return unit;
      },
      PRISMA_SERIALIZABLE_TX,
    );
  }

  private async assertUnidadesNaoBloqueadas(
    solicitacaoId: string,
    etapa: 'PORTARIA' | 'GATE' | 'PATIO' | 'SAIDA',
    actorUserId: string,
    unidadesCarregadas?: Array<{
      numeroIso: string;
      movimentacaoBloqueada: boolean;
      bloqueioMotivo: string | null;
      bloqueioTipo: string | null;
    }>,
  ) {
    const unidades =
      unidadesCarregadas ??
      (await this.prisma.unidade.findMany({ where: { solicitacaoId } }));
    const bloq = unidades.filter((u) => u.movimentacaoBloqueada);
    if (bloq.length === 0) return;
    this.servicosLogisticos.notificarBloqueioMovimentacao({
      solicitacaoId,
      etapa,
      usuario: actorUserId,
      isos: bloq.map((u) => u.numeroIso),
      motivos: bloq.map((u) => u.bloqueioMotivo ?? u.bloqueioTipo ?? 'bloqueado'),
    });
    throw new BadRequestException(
      `Movimentação bloqueada para contêiner(is): ${bloq.map((u) => u.numeroIso).join(', ')}`,
    );
  }

  private async assertSomenteAprovadoParaOperacao(
    solicitacao: { id: string; status: StatusSolicitacao },
    etapa: 'PORTARIA' | 'GATE' | 'PATIO' | 'SAIDA',
    actorUserId: string,
  ) {
    const ok =
      solicitacao.status === StatusSolicitacao.APROVADO ||
      solicitacao.status === StatusSolicitacao.EM_EXECUCAO;
    if (!ok) {
      await registrarViolacaoSequenciaOperacional(this.auditoria, { usuario: actorUserId }, {
        solicitacaoId: solicitacao.id,
        etapa,
        motivo: `Status da solicitação é ${solicitacao.status}; requer APROVADO ou EM_EXECUCAO.`,
      });
      throw new BadRequestException(
        'Operação permitida somente para solicitações aprovadas ou em execução no terminal.',
      );
    }
  }

  async registerPortaria(dto: CreatePortariaDto, actorUserId: string) {
    const solicitacao = await this.prisma.solicitacao.findFirst({
      where: { id: dto.solicitacaoId, deletedAt: null },
      include: { unidades: true },
    });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    await this.assertSomenteAprovadoParaOperacao(solicitacao, 'PORTARIA', actorUserId);
    await this.assertUnidadesNaoBloqueadas(solicitacao.id, 'PORTARIA', actorUserId, solicitacao.unidades);

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.portaria.findUnique({
          where: { solicitacaoId: dto.solicitacaoId },
        });
        const fotoData = {
          ...(dto.fotosCaminhao?.length ? { fotosCaminhao: dto.fotosCaminhao } : {}),
          ...(dto.fotosContainer?.length ? { fotosContainer: dto.fotosContainer } : {}),
          ...(dto.fotosDocumento?.length ? { fotosLacre: dto.fotosDocumento } : {}),
        };
        const row = existing
          ? await tx.portaria.update({
              where: { solicitacaoId: dto.solicitacaoId },
              data: {
                placaVeiculo: dto.placa,
                motoristaNome: dto.motoristaNome ?? null,
                motoristaCpf: dto.motoristaCpf ?? null,
                transportadoraNome: dto.transportadoraNome ?? null,
                motoristaTelefone: dto.motoristaTelefone ?? null,
                ...fotoData,
              },
            })
          : await tx.portaria.create({
              data: {
                solicitacaoId: dto.solicitacaoId,
                placaVeiculo: dto.placa,
                motoristaNome: dto.motoristaNome ?? null,
                motoristaCpf: dto.motoristaCpf ?? null,
                transportadoraNome: dto.transportadoraNome ?? null,
                motoristaTelefone: dto.motoristaTelefone ?? null,
                ...fotoData,
              },
            });

        if (solicitacao.status === StatusSolicitacao.APROVADO) {
          await tx.solicitacao.update({
            where: { id: dto.solicitacaoId },
            data: { status: StatusSolicitacao.EM_EXECUCAO },
          });
          await this.auditoria.registrar(
            {
              tabela: 'solicitacoes',
              registroId: dto.solicitacaoId,
              acao: AcaoAuditoria.UPDATE,
              usuario: actorUserId,
              dadosAntes: { status: StatusSolicitacao.APROVADO },
              dadosDepois: { status: StatusSolicitacao.EM_EXECUCAO, motivo: 'portaria_iniciada' },
            },
            tx,
          );
        }

        await this.auditoria.registrar(
          {
            tabela: 'portarias',
            registroId: row.id,
            acao: existing ? AcaoAuditoria.UPDATE : AcaoAuditoria.INSERT,
            usuario: actorUserId,
            dadosAntes: existing !== null ? existing : undefined,
            dadosDepois: {
              ...row,
              ...(dto.timestamp ? { checkinTimestamp: dto.timestamp } : {}),
            },
          },
          tx,
        );
        return row;
      },
      PRISMA_SERIALIZABLE_TX,
    );
  }

  async findAllPaginated(
    pagination: SolicitacaoPaginationDto,
    filters: { clienteId?: string; status?: StatusSolicitacao },
    actor?: AuthUser,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const rawOb = pagination.orderBy ?? 'createdAt';
    const orderBy = SOLICITACAO_ORDER_BY.has(rawOb) ? rawOb : 'createdAt';
    const order = pagination.order ?? 'desc';
    const skip = (page - 1) * limit;

    let clienteIdFilter = filters.clienteId;
    if (actor?.role === Role.CLIENTE) {
      if (!actor.clienteId) {
        throw new ForbiddenException(
          'Conta de cliente sem vínculo ao cadastro. Solicite o vínculo ao administrador.',
        );
      }
      if (filters.clienteId && filters.clienteId !== actor.clienteId) {
        this.logger.warn(
          `Bloqueio: cliente ${actor.id} tentou listar solicitações com clienteId=${filters.clienteId}`,
        );
        await registrarTentativaForaDeEscopo(this.auditoria, { usuario: actor.id }, {
          recurso: 'solicitacoes_lista',
          tentativaClienteId: filters.clienteId,
          atorClienteId: actor.clienteId,
        });
        throw new ForbiddenException('Não é permitido listar solicitações de outro cadastro.');
      }
      clienteIdFilter = actor.clienteId;
    }

    const where: Prisma.SolicitacaoWhereInput = {
      deletedAt: null,
      ...(clienteIdFilter ? { clienteId: clienteIdFilter } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    if (pagination.createdFrom || pagination.createdTo) {
      where.createdAt = {};
      if (pagination.createdFrom) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(pagination.createdFrom);
      }
      if (pagination.createdTo) {
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(pagination.createdTo);
      }
    }
    const proto = pagination.protocolo?.trim();
    if (proto) {
      where.protocolo = { contains: proto, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.solicitacao.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { [orderBy]: order },
        include: { cliente: true, unidades: true },
      }),
      this.prisma.solicitacao.count({ where }),
    ]);

    return { items, total, page, limit: Math.min(limit, 100), orderBy, order };
  }

  /** Exportação CSV (até 2000 linhas — processamento pesado deve ir para fila no futuro). */
  async buildExportCsv(pagination: SolicitacaoPaginationDto, actor?: AuthUser): Promise<string> {
    const { items } = await this.findAllPaginated(
      { ...pagination, page: 1, limit: 2000 },
      { clienteId: pagination.clienteId, status: pagination.status },
      actor,
    );
    const header = 'protocolo,status,tipoFluxo,clienteId,clienteRazao,isos\n';
    const lines = items.map((s) => {
      const isos = s.unidades.map((u) => u.numeroIso).join('|');
      const nome = (s.cliente?.razaoSocial ?? '').replace(/"/g, '""');
      return [
        s.protocolo,
        s.status,
        s.tipoFluxo ?? '',
        s.clienteId,
        `"${nome}"`,
        isos,
      ].join(',');
    });
    return `${header}${lines.join('\n')}`;
  }

  async findOne(
    id: string,
    actor?: AuthUser,
    leitura?: { auditPortalRead?: boolean; ip?: string; userAgent?: string },
  ) {
    const s = await this.prisma.solicitacao.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente: true,
        unidades: true,
        portaria: true,
        gate: true,
        patio: true,
        saida: true,
      },
    });
    if (!s) throw new NotFoundException('Solicitação não encontrada');
    if (actor?.role === Role.CLIENTE) {
      if (!actor.clienteId) {
        throw new ForbiddenException('Conta de cliente sem vínculo ao cadastro.');
      }
      if (s.clienteId !== actor.clienteId) {
        this.logger.warn(
          `Acesso negado: usuário ${actor.id} à solicitação ${id} (cliente da OS ${s.clienteId})`,
        );
        await registrarTentativaForaDeEscopo(
          this.auditoria,
          { usuario: actor.id, ip: leitura?.ip, userAgent: leitura?.userAgent },
          {
            recurso: 'solicitacao',
            tentativaClienteId: s.clienteId,
            atorClienteId: actor.clienteId,
            registroId: id,
          },
        );
        throw new ForbiddenException('Acesso negado a esta solicitação.');
      }
      if (leitura?.auditPortalRead) {
        await registrarLeituraSensivel(
          this.auditoria,
          { usuario: actor.id, ip: leitura.ip, userAgent: leitura.userAgent },
          'solicitacoes',
          id,
          { rota: 'portal/GET solicitações/:id' },
        );
      }
    }
    return s;
  }

  /** Aprovação pelo cliente: apenas PENDENTE → APROVADO, no próprio cadastro. */
  async aprovarPeloCliente(
    solicitacaoId: string,
    actor: AuthUser,
    ip?: string,
    userAgent?: string,
  ) {
    if (actor.role !== Role.CLIENTE || !actor.clienteId) {
      throw new ForbiddenException('Operação exclusiva do portal do cliente.');
    }
    const current = await this.findOne(solicitacaoId, actor);
    if (current.status !== StatusSolicitacao.PENDENTE) {
      throw new BadRequestException(
        'Apenas solicitações pendentes podem ser aprovadas pelo cliente.',
      );
    }
    return this.update(
      solicitacaoId,
      { status: StatusSolicitacao.APROVADO },
      actor.id,
      actor,
      ip,
      userAgent,
    );
  }

  async update(
    id: string,
    dto: UpdateSolicitacaoDto,
    actorUserId: string,
    actor?: AuthUser,
    ip?: string,
    userAgent?: string,
  ) {
    const current = await this.findOne(id, actor);
    if (dto.status === undefined) {
      return current;
    }

    const allowed = VALID_STATUS_TRANSITIONS[current.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transição de status inválida: de ${current.status} para ${dto.status}`,
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.solicitacao.update({
          where: { id },
          data: { status: dto.status },
          include: { cliente: true, unidades: true },
        });
        await this.auditoria.registrar(
          {
            tabela: 'solicitacoes',
            registroId: id,
            acao: AcaoAuditoria.UPDATE,
            usuario: actorUserId,
            dadosAntes: { status: current.status },
            dadosDepois: { status: updated.status },
            ip,
            userAgent,
          },
          tx,
        );
        return updated;
      },
      PRISMA_SERIALIZABLE_TX,
    );
  }

  async remove(id: string, actorUserId: string, ip?: string, userAgent?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.solicitacao.findFirst({
          where: { id, deletedAt: null },
          include: { unidades: true, cliente: true },
        });
        if (!current) throw new NotFoundException('Solicitação não encontrada');

        const deletedAt = new Date();
        const updated = await tx.solicitacao.update({
          where: { id },
          data: { deletedAt },
        });

        await this.auditoria.registrar(
          {
            tabela: 'solicitacoes',
            registroId: id,
            acao: AcaoAuditoria.DELETE,
            usuario: actorUserId,
            dadosAntes: current,
            dadosDepois: updated,
            ip,
            userAgent,
          },
          tx,
        );

        return { id, removed: true, deletedAt };
      },
      PRISMA_SERIALIZABLE_TX,
    );
  }

  async registerGate(dto: CreateGateDto, actorUserId: string) {
    const solicitacao = await this.prisma.solicitacao.findFirst({
      where: { id: dto.solicitacaoId, deletedAt: null },
      include: { portaria: true, unidades: true },
    });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    await this.assertSomenteAprovadoParaOperacao(solicitacao, 'GATE', actorUserId);
    await this.assertUnidadesNaoBloqueadas(solicitacao.id, 'GATE', actorUserId, solicitacao.unidades);
    if (!solicitacao.portaria) {
      await registrarViolacaoSequenciaOperacional(this.auditoria, { usuario: actorUserId }, {
        solicitacaoId: solicitacao.id,
        etapa: 'GATE',
        motivo: 'Registro de gate exige portaria concluída anteriormente.',
      });
      throw new BadRequestException(
        'Não é possível registrar o gate sem registro de portaria para esta solicitação.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.gate.findUnique({
          where: { solicitacaoId: dto.solicitacaoId },
        });
        const ric = dto.ricAssinado ?? false;
        const row = existing
          ? await tx.gate.update({
              where: { solicitacaoId: dto.solicitacaoId },
              data: { ricAssinado: ric },
            })
          : await tx.gate.create({
              data: {
                solicitacaoId: dto.solicitacaoId,
                ricAssinado: ric,
              },
            });
        await this.auditoria.registrar(
          {
            tabela: 'gates',
            registroId: row.id,
            acao: existing ? AcaoAuditoria.UPDATE : AcaoAuditoria.INSERT,
            usuario: actorUserId,
            dadosAntes: existing ?? undefined,
            dadosDepois: row,
          },
          tx,
        );
        return row;
      },
      PRISMA_SERIALIZABLE_TX,
    );
  }

  async registerPatio(dto: CreatePatioDto, actorUserId: string) {
    const solicitacao = await this.prisma.solicitacao.findFirst({
      where: { id: dto.solicitacaoId, deletedAt: null },
      include: { gate: true, unidades: true },
    });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    await this.assertSomenteAprovadoParaOperacao(solicitacao, 'PATIO', actorUserId);
    await this.assertUnidadesNaoBloqueadas(solicitacao.id, 'PATIO', actorUserId, solicitacao.unidades);
    if (!solicitacao.gate) {
      await registrarViolacaoSequenciaOperacional(this.auditoria, { usuario: actorUserId }, {
        solicitacaoId: solicitacao.id,
        etapa: 'PATIO',
        motivo: 'Posicionamento no pátio exige gate registrado anteriormente.',
      });
      throw new BadRequestException(
        'Não é possível registrar o pátio sem registro de gate para esta solicitação.',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.patio.findUnique({
            where: { solicitacaoId: dto.solicitacaoId },
          });
          const row = existing
            ? await tx.patio.update({
                where: { solicitacaoId: dto.solicitacaoId },
                data: {
                  quadra: dto.quadra,
                  fileira: dto.fileira,
                  posicao: dto.posicao,
                },
              })
            : await tx.patio.create({
                data: {
                  solicitacaoId: dto.solicitacaoId,
                  quadra: dto.quadra,
                  fileira: dto.fileira,
                  posicao: dto.posicao,
                },
              });
          await this.auditoria.registrar(
            {
              tabela: 'patios',
              registroId: row.id,
              acao: existing ? AcaoAuditoria.UPDATE : AcaoAuditoria.INSERT,
              usuario: actorUserId,
              dadosAntes: existing ?? undefined,
              dadosDepois: row,
            },
            tx,
          );
          return row;
        },
        PRISMA_SERIALIZABLE_TX,
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Posição de pátio já ocupada por outra solicitação (quadra/fileira/posição únicos).',
        );
      }
      throw error;
    }
  }

  async registerSaida(dto: CreateSaidaDto, actorUserId: string) {
    const solicitacao = await this.prisma.solicitacao.findFirst({
      where: { id: dto.solicitacaoId, deletedAt: null },
      include: { patio: true, unidades: true },
    });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    await this.assertSomenteAprovadoParaOperacao(solicitacao, 'SAIDA', actorUserId);
    await this.assertUnidadesNaoBloqueadas(solicitacao.id, 'SAIDA', actorUserId, solicitacao.unidades);
    if (!solicitacao.patio) {
      await registrarViolacaoSequenciaOperacional(this.auditoria, { usuario: actorUserId }, {
        solicitacaoId: solicitacao.id,
        etapa: 'SAIDA',
        motivo: 'Saída exige unidade posicionada no pátio (registro de pátio anterior).',
      });
      throw new BadRequestException(
        'Não é possível registrar a saída sem registro de pátio para esta solicitação.',
      );
    }
    const dataHora = new Date(dto.dataHoraSaida);

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.saida.findUnique({
          where: { solicitacaoId: dto.solicitacaoId },
        });
        const row = existing
          ? await tx.saida.update({
              where: { solicitacaoId: dto.solicitacaoId },
              data: { dataHoraSaida: dataHora },
            })
          : await tx.saida.create({
              data: {
                solicitacaoId: dto.solicitacaoId,
                dataHoraSaida: dataHora,
              },
            });
        await this.auditoria.registrar(
          {
            tabela: 'saidas',
            registroId: row.id,
            acao: existing ? AcaoAuditoria.UPDATE : AcaoAuditoria.INSERT,
            usuario: actorUserId,
            dadosAntes: existing ?? undefined,
            dadosDepois: row,
          },
          tx,
        );
        return row;
      },
      PRISMA_SERIALIZABLE_TX,
    );
  }
}
