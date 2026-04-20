import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 15000,
} as const;

@Injectable()
export class ClientesService {
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

  async findAll(page: number = 1, limit: number = 10) {
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10;

    const skip = (page - 1) * limit;

    const [clientes, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      this.prisma.cliente.count({
        where: { deletedAt: null },
      }),
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

  async findOne(id: string) {
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