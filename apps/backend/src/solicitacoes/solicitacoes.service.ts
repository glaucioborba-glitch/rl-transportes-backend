import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma, StatusSolicitacao } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SolicitacaoPaginationDto } from '../common/dtos/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AddUnidadeSolicitacaoDto } from './dto/add-unidade-solicitacao.dto';
import { CreatePortariaDto } from './dto/create-portaria.dto';
import { CreateSolicitacaoDto } from './dto/create-solicitacao.dto';
import { UpdateSolicitacaoDto } from './dto/update-solicitacao.dto';

/** Transições válidas de status (documento Semana 2). */
export const VALID_STATUS_TRANSITIONS: Record<StatusSolicitacao, StatusSolicitacao[]> = {
  [StatusSolicitacao.PENDENTE]: [StatusSolicitacao.APROVADO, StatusSolicitacao.REJEITADO],
  [StatusSolicitacao.APROVADO]: [StatusSolicitacao.CONCLUIDO, StatusSolicitacao.REJEITADO],
  [StatusSolicitacao.CONCLUIDO]: [],
  [StatusSolicitacao.REJEITADO]: [],
};

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 15000,
} as const;

function gerarProtocolo(): string {
  const y = new Date().getFullYear();
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `RL-${y}-${rand}`;
}

@Injectable()
export class SolicitacoesService {
  private readonly logger = new Logger(SolicitacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
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
              },
            });
            await tx.unidadeSolicitacao.createMany({
              data: dto.unidades.map((u) => ({
                solicitacaoId: sol.id,
                numeroIso: u.numeroIso,
                tipo: u.tipo,
              })),
            });
            const full = await tx.solicitacao.findUniqueOrThrow({
              where: { id: sol.id },
              include: { unidadesSolicitacao: true, cliente: true },
            });
            await this.auditoria.registrar(tx, {
              tabela: 'solicitacoes',
              registroId: sol.id,
              acao: AcaoAuditoria.INSERT,
              userId: actorUserId,
              dadosDepois: full,
            });
            this.logger.log(`Solicitação criada protocolo=${protocolo} id=${sol.id}`);
            return full;
          },
          TX_OPTIONS,
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
    const solicitacao = await this.prisma.solicitacao.findFirst({
      where: { id: dto.solicitacaoId, deletedAt: null },
    });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const dup = await tx.unidadeSolicitacao.findUnique({
          where: { numeroIso: dto.numeroIso },
        });
        if (dup) {
          throw new ConflictException('Número ISO já cadastrado');
        }
        const unit = await tx.unidadeSolicitacao.create({
          data: {
            solicitacaoId: dto.solicitacaoId,
            numeroIso: dto.numeroIso,
            tipo: dto.tipo,
          },
        });
        await this.auditoria.registrar(tx, {
          tabela: 'unidades_solicitacao',
          registroId: unit.id,
          acao: AcaoAuditoria.INSERT,
          userId: actorUserId,
          dadosDepois: unit,
        });
        return unit;
      },
      TX_OPTIONS,
    );
  }

  async registerPortaria(dto: CreatePortariaDto, actorUserId: string) {
    const solicitacao = await this.prisma.solicitacao.findFirst({
      where: { id: dto.solicitacaoId, deletedAt: null },
    });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.portaria.findUnique({
          where: { solicitacaoId: dto.solicitacaoId },
        });
        const row = existing
          ? await tx.portaria.update({
              where: { solicitacaoId: dto.solicitacaoId },
              data: { placaVeiculo: dto.placa },
            })
          : await tx.portaria.create({
              data: {
                solicitacaoId: dto.solicitacaoId,
                placaVeiculo: dto.placa,
              },
            });
        await this.auditoria.registrar(tx, {
          tabela: 'portarias',
          registroId: row.id,
          acao: existing ? AcaoAuditoria.UPDATE : AcaoAuditoria.INSERT,
          userId: actorUserId,
          dadosAntes: existing !== null ? existing : undefined,
          dadosDepois: row,
        });
        return row;
      },
      TX_OPTIONS,
    );
  }

  async findAllPaginated(
    pagination: SolicitacaoPaginationDto,
    filters: { clienteId?: string; status?: StatusSolicitacao },
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const orderBy = pagination.orderBy ?? 'createdAt';
    const order = pagination.order ?? 'desc';
    const skip = (page - 1) * limit;

    const where: Prisma.SolicitacaoWhereInput = {
      deletedAt: null,
      ...(filters.clienteId ? { clienteId: filters.clienteId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.solicitacao.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { [orderBy]: order },
        include: { cliente: true, unidadesSolicitacao: true },
      }),
      this.prisma.solicitacao.count({ where }),
    ]);

    return { items, total, page, limit: Math.min(limit, 100), orderBy, order };
  }

  async findOne(id: string) {
    const s = await this.prisma.solicitacao.findFirst({
      where: { id, deletedAt: null },
      include: { cliente: true, unidadesSolicitacao: true },
    });
    if (!s) throw new NotFoundException('Solicitação não encontrada');
    return s;
  }

  async update(id: string, dto: UpdateSolicitacaoDto, actorUserId: string) {
    const current = await this.findOne(id);
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
          include: { cliente: true, unidadesSolicitacao: true },
        });
        await this.auditoria.registrar(tx, {
          tabela: 'solicitacoes',
          registroId: id,
          acao: AcaoAuditoria.UPDATE,
          userId: actorUserId,
          dadosAntes: { status: current.status },
          dadosDepois: { status: updated.status },
        });
        return updated;
      },
      TX_OPTIONS,
    );
  }

  async remove(id: string, actorUserId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.solicitacao.findFirst({
          where: { id, deletedAt: null },
          include: { unidadesSolicitacao: true, cliente: true },
        });
        if (!current) throw new NotFoundException('Solicitação não encontrada');

        const deletedAt = new Date();
        const updated = await tx.solicitacao.update({
          where: { id },
          data: { deletedAt },
        });

        await this.auditoria.registrar(tx, {
          tabela: 'solicitacoes',
          registroId: id,
          acao: AcaoAuditoria.DELETE,
          userId: actorUserId,
          dadosAntes: current,
          dadosDepois: updated,
        });

        return { id, removed: true, deletedAt };
      },
      TX_OPTIONS,
    );
  }
}
