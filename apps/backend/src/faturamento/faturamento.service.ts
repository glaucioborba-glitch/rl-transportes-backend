import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { NfseService } from '../nfse/nfse.service';
import { registrarLeituraSensivel, registrarTentativaForaDeEscopo } from '../common/security/scope-audit.util';
import { CreateBoletoDto } from './dto/create-boleto.dto';
import { CreateFaturamentoDto } from './dto/create-faturamento.dto';
import { FaturamentoQueryDto } from './dto/faturamento-query.dto';
import { PortalBoletosQueryDto } from './dto/portal-boletos-query.dto';
import { UpdateBoletoDto } from './dto/update-boleto.dto';
import { EmitirNfseDto } from '../nfse/dto/emitir-nfse.dto';
import { CancelarNfseDto } from '../nfse/dto/cancelar-nfse.dto';

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 15000,
} as const;

@Injectable()
export class FaturamentoService {
  private readonly logger = new Logger(FaturamentoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly nfseService: NfseService,
  ) {}

  private isStaff(actor: AuthUser) {
    return actor.role === Role.ADMIN || actor.role === Role.GERENTE;
  }

  async create(
    dto: CreateFaturamentoDto,
    actorUserId: string,
    actor: AuthUser,
    ip?: string,
    userAgent?: string,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException('Apenas administradores podem criar faturamento.');
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: dto.clienteId, deletedAt: null },
    });
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const solicitacaoIds = [...new Set(dto.solicitacaoIds ?? [])];
    if (solicitacaoIds.length > 0) {
      const sols = await this.prisma.solicitacao.findMany({
        where: {
          id: { in: solicitacaoIds },
          deletedAt: null,
          clienteId: dto.clienteId,
        },
      });
      if (sols.length !== solicitacaoIds.length) {
        throw new ConflictException(
          'Uma ou mais solicitações não pertencem ao cliente ou estão inativas.',
        );
      }
    }

    let soma = new Prisma.Decimal(0);
    for (const it of dto.itens) {
      soma = soma.add(new Prisma.Decimal(it.valor));
    }
    const valorTotal = new Prisma.Decimal(soma.toFixed(2));

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const fat = await tx.faturamento.create({
            data: {
              clienteId: dto.clienteId,
              periodo: dto.periodo,
              valorTotal,
              itens: {
                create: dto.itens.map((i) => ({
                  descricao: i.descricao.trim(),
                  valor: new Prisma.Decimal(new Prisma.Decimal(i.valor).toFixed(2)),
                })),
              },
            },
          });
          if (solicitacaoIds.length > 0) {
            await tx.faturamentoSolicitacao.createMany({
              data: solicitacaoIds.map((solicitacaoId) => ({
                faturamentoId: fat.id,
                solicitacaoId,
              })),
            });
          }
          const full = await tx.faturamento.findUniqueOrThrow({
            where: { id: fat.id },
            include: {
              solicitacoesVinculadas: { include: { solicitacao: true } },
              cliente: true,
              itens: true,
            },
          });
          await this.auditoria.registrar(
            {
              tabela: 'faturamentos',
              registroId: fat.id,
              acao: AcaoAuditoria.INSERT,
              usuario: actorUserId,
              dadosDepois: full,
              ip,
              userAgent,
            },
            tx,
          );
          return full;
        },
        TX_OPTIONS,
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe faturamento para este cliente e período.');
      }
      throw e;
    }
  }

  async findAll(query: FaturamentoQueryDto, actor: AuthUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FaturamentoWhereInput = {};
    if (actor.role === Role.CLIENTE) {
      if (!actor.clienteId) {
        throw new ForbiddenException('Conta sem vínculo a cadastro de cliente.');
      }
      if (query.clienteId && query.clienteId !== actor.clienteId) {
        this.logger.warn(
          `Bloqueio: cliente ${actor.id} tentou filtrar faturamento de outro clienteId=${query.clienteId}`,
        );
        await registrarTentativaForaDeEscopo(this.auditoria, { usuario: actor.id }, {
          recurso: 'faturamento_lista',
          tentativaClienteId: query.clienteId,
          atorClienteId: actor.clienteId,
        });
        throw new ForbiddenException('Não é permitido filtrar faturamento de outro cadastro.');
      }
      // Sempre o próprio cadastro
      where.clienteId = actor.clienteId;
    } else if (!this.isStaff(actor)) {
      throw new ForbiddenException('Sem permissão para consultar faturamento.');
    } else if (query.clienteId) {
      where.clienteId = query.clienteId;
    }
    if (query.periodo) {
      where.periodo = query.periodo;
    }

    const [items, total] = await Promise.all([
      this.prisma.faturamento.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { createdAt: 'desc' },
        include: {
          cliente: { select: { id: true, nome: true, email: true } },
          itens: true,
          solicitacoesVinculadas: { include: { solicitacao: { select: { id: true, protocolo: true, status: true } } } },
          _count: { select: { nfsEmitidas: true, boletos: true } },
        },
      }),
      this.prisma.faturamento.count({ where }),
    ]);

    return { items, total, page, limit: Math.min(limit, 100) };
  }

  async findOne(
    id: string,
    actor: AuthUser,
    leitura?: { auditar?: boolean; ip?: string; userAgent?: string },
  ) {
    const row = await this.prisma.faturamento.findUnique({
      where: { id },
      include: {
        cliente: true,
        nfsEmitidas: true,
        boletos: true,
        itens: true,
        solicitacoesVinculadas: { include: { solicitacao: true } },
      },
    });
    if (!row) throw new NotFoundException('Faturamento não encontrado');
    if (actor.role === Role.CLIENTE) {
      if (!actor.clienteId) {
        throw new ForbiddenException('Conta sem vínculo a cadastro de cliente.');
      }
      if (row.clienteId !== actor.clienteId) {
        this.logger.warn(
          `Acesso negado: usuário ${actor.id} ao faturamento ${id} (cliente ${row.clienteId})`,
        );
        await registrarTentativaForaDeEscopo(this.auditoria, { usuario: actor.id, ip: leitura?.ip, userAgent: leitura?.userAgent }, {
          recurso: 'faturamento',
          tentativaClienteId: row.clienteId,
          atorClienteId: actor.clienteId,
          registroId: id,
        });
        throw new ForbiddenException('Acesso negado a este faturamento.');
      }
      if (leitura?.auditar) {
        await registrarLeituraSensivel(
          this.auditoria,
          { usuario: actor.id, ip: leitura.ip, userAgent: leitura.userAgent },
          'faturamentos',
          id,
          { rota: 'portal/GET faturamento/:id' },
        );
      }
    } else if (!this.isStaff(actor)) {
      throw new ForbiddenException();
    }
    return row;
  }

  /**
   * Emite NFS-e via Web Service IPM/Atende.Net (Navegantes), persiste resposta e auditoria.
   */
  async emitirNfse(
    faturamentoId: string,
    dto: EmitirNfseDto,
    actorUserId: string,
    actor: AuthUser,
    ip: string,
    userAgent: string,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException();
    }
    await this.findOne(faturamentoId, actor);
    return this.nfseService.emitirNfse(faturamentoId, dto, actorUserId, actor, ip, userAgent);
  }

  /**
   * Cancela NFS-e no provedor, atualiza status e grava motivo (auditoria em `NfseService`).
   */
  async cancelarNfseFaturamento(
    faturamentoId: string,
    dto: CancelarNfseDto,
    actorUserId: string,
    actor: AuthUser,
    ip: string,
    userAgent: string,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException();
    }
    await this.findOne(faturamentoId, actor);
    return this.nfseService.cancelarNfse(faturamentoId, dto, actorUserId, actor, ip, userAgent);
  }

  async createBoleto(
    faturamentoId: string,
    dto: CreateBoletoDto,
    actorUserId: string,
    actor: AuthUser,
    ip?: string,
    userAgent?: string,
  ) {
    if (!this.isStaff(actor)) throw new ForbiddenException();
    await this.findOne(faturamentoId, actor);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const b = await tx.boleto.create({
            data: {
              faturamentoId,
              numeroBoleto: dto.numeroBoleto,
              dataVencimento: new Date(dto.dataVencimento),
              valorBoleto: new Prisma.Decimal(dto.valorBoleto),
              statusPagamento: 'pendente',
            },
          });
          await this.auditoria.registrar(
            {
              tabela: 'boletos',
              registroId: b.id,
              acao: AcaoAuditoria.INSERT,
              usuario: actorUserId,
              dadosDepois: b,
              ip,
              userAgent,
            },
            tx,
          );
          return b;
        },
        TX_OPTIONS,
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Número de boleto já cadastrado');
      }
      throw e;
    }
  }

  async updateBoleto(
    boletoId: string,
    dto: UpdateBoletoDto,
    actorUserId: string,
    actor: AuthUser,
    ip?: string,
    userAgent?: string,
  ) {
    if (!this.isStaff(actor)) throw new ForbiddenException();
    const current = await this.prisma.boleto.findUnique({
      where: { id: boletoId },
      include: { faturamento: true },
    });
    if (!current) throw new NotFoundException('Boleto não encontrado');

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.boleto.update({
          where: { id: boletoId },
          data: { statusPagamento: dto.statusPagamento },
        });
        await this.auditoria.registrar(
          {
            tabela: 'boletos',
            registroId: boletoId,
            acao: AcaoAuditoria.UPDATE,
            usuario: actorUserId,
            dadosAntes: { statusPagamento: current.statusPagamento },
            dadosDepois: { statusPagamento: updated.statusPagamento },
            ip,
            userAgent,
          },
          tx,
        );
        return updated;
      },
      TX_OPTIONS,
    );
  }

  /** Listagem de boletos do cliente (portal — acompanhamento). Somente Role.CLIENTE com clienteId. */
  async listBoletosPortal(query: PortalBoletosQueryDto, actor: AuthUser) {
    if (actor.role !== Role.CLIENTE || !actor.clienteId) {
      throw new ForbiddenException(
        'Disponível apenas para usuários do portal vinculados a um cliente.',
      );
    }
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const where: Prisma.BoletoWhereInput = {
      faturamento: { clienteId: actor.clienteId },
    };
    const [items, total] = await Promise.all([
      this.prisma.boleto.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataVencimento: 'asc' },
        include: {
          faturamento: {
            select: { id: true, periodo: true, statusNfe: true, statusBoleto: true },
          },
        },
      }),
      this.prisma.boleto.count({ where }),
    ]);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return { items, meta: { total, page, limit, totalPages } };
  }

}
