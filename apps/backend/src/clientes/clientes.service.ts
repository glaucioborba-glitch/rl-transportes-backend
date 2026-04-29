import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { registrarTentativaForaDeEscopo } from '../common/security/scope-audit.util';
import { ClientePaginationDto } from '../common/dtos/pagination.dto';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 15000,
} as const;

/** Whitelist de ordenação (alinha ao ClientePaginationDto e evita chaves arbitrárias). */
const CLIENTE_ORDER_BY = new Set(['createdAt', 'nome', 'email']);

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
  ) {}

  async create(
    createClienteDto: CreateClienteDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    const cpfCnpjClean = createClienteDto.cpfCnpj.replace(/\D/g, '');

    try {
      const cliente = await this.prisma.$transaction(async (tx) => {
        const novoCliente = await tx.cliente.create({
          data: {
            nome: createClienteDto.nome,
            tipo: createClienteDto.tipo,
            cpfCnpj: cpfCnpjClean,
            email: createClienteDto.email.toLowerCase(),
            telefone: createClienteDto.telefone ?? '',
            endereco: createClienteDto.endereco ?? '',
          },
        });

        await this.auditoria.registrar(
          {
            tabela: 'clientes',
            registroId: novoCliente.id,
            acao: AcaoAuditoria.INSERT,
            usuario: usuarioId,
            dadosAntes: null,
            dadosDepois: novoCliente,
            ip,
            userAgent,
          },
          tx,
        );

        return novoCliente;
      }, TX_OPTIONS);

      return this.sanitizeCliente(cliente);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'CPF/CNPJ ou E-mail já cadastrado no sistema',
        );
      }
      throw error;
    }
  }

  async findAllPaginated(query: ClientePaginationDto, actor?: AuthUser) {
    let page = query.page ?? 1;
    let limit = query.limit ?? 10;
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10;

    const skip = (page - 1) * limit;
    const rawOrderBy = query.orderBy ?? 'createdAt';
    const orderBy = CLIENTE_ORDER_BY.has(rawOrderBy) ? rawOrderBy : 'createdAt';
    const order = query.order ?? 'desc';

    const search = query.search?.trim();
    const where: Prisma.ClienteWhereInput = { deletedAt: null };
    if (actor?.role === Role.CLIENTE) {
      if (!actor.clienteId) {
        throw new ForbiddenException(
          'Usuário de portal sem vínculo a cliente; contate o suporte.',
        );
      }
      where.id = actor.clienteId;
    }
    if (search) {
      const digits = search.replace(/\D/g, '');
      const orClause: Prisma.ClienteWhereInput[] = [
        { nome: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
      if (digits.length >= 3) {
        orClause.push({ cpfCnpj: { contains: digits } });
      }
      where.OR = orClause;
    }

    const [clientes, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: order },
        select: {
          id: true,
          nome: true,
          tipo: true,
          email: true,
          telefone: true,
          createdAt: true,
          solicitacoes: {
            where: { deletedAt: null },
            select: {
              id: true,
              protocolo: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return {
      data: clientes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    actor?: AuthUser,
    leitura?: { ip?: string; userAgent?: string },
  ) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, deletedAt: null },
      include: {
        solicitacoes: {
          where: { deletedAt: null },
          include: { unidades: true },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado.`);
    }

    if (actor?.role === Role.CLIENTE) {
      if (!actor.clienteId) {
        throw new ForbiddenException(
          'Usuário de portal sem vínculo a cliente; contate o suporte.',
        );
      }
      if (id !== actor.clienteId) {
        this.logger.warn(
          `Acesso negado: usuário ${actor.id} consultou cadastro de cliente ${id} (vínculo ${actor.clienteId})`,
        );
        await registrarTentativaForaDeEscopo(
          this.auditoria,
          { usuario: actor.id, ip: leitura?.ip, userAgent: leitura?.userAgent },
          {
            recurso: 'cliente',
            tentativaClienteId: id,
            atorClienteId: actor.clienteId,
            registroId: id,
          },
        );
        throw new ForbiddenException('Acesso negado a este cadastro.');
      }
    }

    return cliente;
  }

  async update(
    id: string,
    updateClienteDto: UpdateClienteDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    const clienteAntes = await this.prisma.cliente.findUnique({
      where: { id },
    });

    if (!clienteAntes) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado.`);
    }

    try {
      const clienteDepois = await this.prisma.$transaction(async (tx) => {
        const dadosAtualizacao: Prisma.ClienteUpdateInput = {};

        if (updateClienteDto.nome !== undefined) {
          dadosAtualizacao.nome = updateClienteDto.nome;
        }
        if (updateClienteDto.tipo !== undefined) {
          dadosAtualizacao.tipo = updateClienteDto.tipo;
        }
        if (updateClienteDto.cpfCnpj !== undefined) {
          dadosAtualizacao.cpfCnpj = updateClienteDto.cpfCnpj.replace(/\D/g, '');
        }
        if (updateClienteDto.email !== undefined) {
          dadosAtualizacao.email = updateClienteDto.email.toLowerCase();
        }
        if (updateClienteDto.telefone !== undefined) {
          dadosAtualizacao.telefone = updateClienteDto.telefone;
        }
        if (updateClienteDto.endereco !== undefined) {
          dadosAtualizacao.endereco = updateClienteDto.endereco;
        }

        const updated = await tx.cliente.update({
          where: { id },
          data: dadosAtualizacao,
        });

        await this.auditoria.registrar(
          {
            tabela: 'clientes',
            registroId: id,
            acao: AcaoAuditoria.UPDATE,
            usuario: usuarioId,
            dadosAntes: clienteAntes,
            dadosDepois: updated,
            ip,
            userAgent,
          },
          tx,
        );

        return updated;
      }, TX_OPTIONS);

      return this.sanitizeCliente(clienteDepois);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'CPF/CNPJ ou E-mail já cadastrado no sistema',
        );
      }
      throw error;
    }
  }

  async remove(id: string, usuarioId: string, ip: string, userAgent: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado.`);
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.cliente.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        await this.auditoria.registrar(
          {
            tabela: 'clientes',
            registroId: id,
            acao: AcaoAuditoria.DELETE,
            usuario: usuarioId,
            dadosAntes: cliente,
            dadosDepois: null,
            ip,
            userAgent,
          },
          tx,
        );
      },
      TX_OPTIONS,
    );

    return { id, removed: true, timestamp: new Date() };
  }

  private sanitizeCliente(cliente: any) {
    const { ...safe } = cliente;
    return safe;
  }
}