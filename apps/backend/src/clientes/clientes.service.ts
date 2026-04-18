import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AcaoAuditoria, Prisma, TipoCliente } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ClientePaginationDto } from '../common/dtos/pagination.dto';
import {
  onlyDigits,
  validateCnpjDigits,
  validateCpfDigits,
} from '../common/utils/br-documents';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 15000,
} as const;

const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheKey = (id: string) => `cliente:${id}`;

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private validateDocumento(tipo: TipoCliente, digits: string) {
    if (tipo === TipoCliente.PF) {
      if (digits.length !== 11 || !validateCpfDigits(digits)) {
        throw new BadRequestException('CPF inválido');
      }
    } else {
      if (digits.length !== 14 || !validateCnpjDigits(digits)) {
        throw new BadRequestException('CNPJ inválido');
      }
    }
  }

  async create(dto: CreateClienteDto, actorUserId: string) {
    const email = dto.email.toLowerCase();
    this.logger.log(`Criando cliente documento=${dto.cpfCnpj} email=${email}`);

    return this.prisma.$transaction(
      async (tx) => {
        const dup = await tx.cliente.findFirst({
          where: {
            deletedAt: null,
            OR: [{ cpfCnpj: dto.cpfCnpj }, { email }],
          },
        });
        if (dup) {
          throw new ConflictException('E-mail ou documento já cadastrado');
        }
        const cliente = await tx.cliente.create({
          data: {
            nome: dto.nome.trim(),
            tipo: dto.tipo,
            cpfCnpj: dto.cpfCnpj,
            email,
            telefone: dto.telefone.trim(),
            endereco: dto.endereco.trim(),
          },
        });
        await this.auditoria.registrar(tx, {
          tabela: 'clientes',
          registroId: cliente.id,
          acao: AcaoAuditoria.INSERT,
          userId: actorUserId,
          dadosDepois: cliente,
        });
        return cliente;
      },
      TX_OPTIONS,
    );
  }

  async findAllPaginated(pagination: ClientePaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const orderBy = pagination.orderBy ?? 'createdAt';
    const order = pagination.order ?? 'desc';
    const skip = (page - 1) * limit;
    const search = pagination.search;

    const searchWhere: Prisma.ClienteWhereInput = search
      ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { cpfCnpj: { contains: onlyDigits(search) } },
          ],
        }
      : {};

    const where: Prisma.ClienteWhereInput = {
      deletedAt: null,
      ...(search ? searchWhere : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { [orderBy]: order },
        include: {
          solicitacoes: {
            where: { deletedAt: null },
            select: { id: true, protocolo: true, status: true, createdAt: true },
            take: 50,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    this.logger.debug(`findAllPaginated page=${page} total=${total}`);
    return { items, total, page, limit: Math.min(limit, 100), orderBy, order };
  }

  async findOne(id: string) {
    const hit = await this.cache.get<unknown>(cacheKey(id));
    if (hit) {
      this.logger.debug(`cache hit cliente ${id}`);
      return hit;
    }
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, deletedAt: null },
      include: {
        solicitacoes: {
          where: { deletedAt: null },
          select: {
            id: true,
            protocolo: true,
            status: true,
            createdAt: true,
          },
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    await this.cache.set(cacheKey(id), cliente, CACHE_TTL_MS);
    return cliente;
  }

  async update(id: string, dto: UpdateClienteDto, actorUserId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.cliente.findFirst({ where: { id, deletedAt: null } });
        if (!current) throw new NotFoundException('Cliente não encontrado');

        const tipo = dto.tipo ?? current.tipo;
        const digits = dto.cpfCnpj ? onlyDigits(dto.cpfCnpj) : current.cpfCnpj;
        if (dto.cpfCnpj !== undefined || dto.tipo !== undefined) {
          this.validateDocumento(tipo, digits);
        }

        const data: Prisma.ClienteUpdateInput = {};
        if (dto.nome !== undefined) data.nome = dto.nome.trim();
        if (dto.tipo !== undefined) data.tipo = dto.tipo;
        if (dto.cpfCnpj !== undefined) data.cpfCnpj = digits;
        if (dto.email !== undefined) data.email = dto.email.toLowerCase();
        if (dto.telefone !== undefined) data.telefone = dto.telefone.trim();
        if (dto.endereco !== undefined) data.endereco = dto.endereco.trim();

        let updated;
        try {
          updated = await tx.cliente.update({
            where: { id },
            data,
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            throw new ConflictException('E-mail ou documento já cadastrado');
          }
          throw e;
        }

        await this.auditoria.registrar(tx, {
          tabela: 'clientes',
          registroId: id,
          acao: AcaoAuditoria.UPDATE,
          userId: actorUserId,
          dadosAntes: current,
          dadosDepois: updated,
        });
        await this.cache.del(cacheKey(id));
        return updated;
      },
      TX_OPTIONS,
    );
  }

  async remove(id: string, actorUserId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.cliente.findFirst({ where: { id, deletedAt: null } });
        if (!current) throw new NotFoundException('Cliente não encontrado');

        const deletedAt = new Date();
        const updated = await tx.cliente.update({
          where: { id },
          data: { deletedAt },
        });

        await this.auditoria.registrar(tx, {
          tabela: 'clientes',
          registroId: id,
          acao: AcaoAuditoria.DELETE,
          userId: actorUserId,
          dadosAntes: current,
          dadosDepois: updated,
        });

        await this.cache.del(cacheKey(id));
        return { id, removed: true, deletedAt };
      },
      TX_OPTIONS,
    );
  }
}
