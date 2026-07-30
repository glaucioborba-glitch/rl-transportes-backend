import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CadastrosMotivoRejeicaoFormDto,
  CadastrosMotivoRejeicaoQueryDto,
  CadastrosTurnoFormDto,
} from './dto/cadastros-turno-motivo-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosTurnosService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.cadastroTurno.findMany({
      where: { deletedAt: null },
      orderBy: { codigo: 'asc' },
    });
    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    return this.toShape(await this.getRowOrThrow(id));
  }

  async create(dto: CadastrosTurnoFormDto) {
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroTurno.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroTurno.create({ data: this.toData(dto, codigo) });
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosTurnoFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroTurno.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null, NOT: { id } },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroTurno.update({
      where: { id },
      data: { ...this.toData(dto, codigo), deletedAt: dto.ativo === false ? new Date() : null },
    });
    return this.toShape(row);
  }

  private toData(dto: CadastrosTurnoFormDto, codigo: string) {
    return {
      tenantId: DEFAULT_TENANT,
      codigo,
      nome: dto.nome.trim(),
      horaInicio: dto.horaInicio,
      horaFim: dto.horaFim,
      capacidadeMaxima: dto.capacidadeMaxima ?? null,
      diasSemana: dto.diasSemana ?? [],
      ativo: dto.ativo ?? true,
    };
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroTurno.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Turno não encontrado.');
    return row;
  }

  private toShape(row: {
    id: string;
    codigo: string;
    nome: string;
    horaInicio: string;
    horaFim: string;
    capacidadeMaxima: number | null;
    diasSemana: unknown;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      horaInicio: row.horaInicio,
      horaFim: row.horaFim,
      capacidadeMaxima: row.capacidadeMaxima,
      diasSemana: Array.isArray(row.diasSemana) ? row.diasSemana : [],
      ativo: row.ativo,
    };
  }
}

@Injectable()
export class CadastrosMotivosRejeicaoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CadastrosMotivoRejeicaoQueryDto) {
    const where: { deletedAt: null; tipo?: string } = { deletedAt: null };
    const tipo = query.tipo?.trim();
    if (tipo && tipo !== 'todos') where.tipo = tipo;

    const rows = await this.prisma.cadastroMotivoRejeicao.findMany({
      where,
      orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
    });
    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    return this.toShape(await this.getRowOrThrow(id));
  }

  async create(dto: CadastrosMotivoRejeicaoFormDto) {
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroMotivoRejeicao.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroMotivoRejeicao.create({ data: this.toData(dto, codigo) });
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosMotivoRejeicaoFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroMotivoRejeicao.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null, NOT: { id } },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroMotivoRejeicao.update({
      where: { id },
      data: { ...this.toData(dto, codigo), deletedAt: dto.ativo === false ? new Date() : null },
    });
    return this.toShape(row);
  }

  private toData(dto: CadastrosMotivoRejeicaoFormDto, codigo: string) {
    return {
      tenantId: DEFAULT_TENANT,
      codigo,
      descricao: dto.descricao.trim(),
      tipo: dto.tipo ?? 'REJEICAO_GATE',
      exigeObservacao: dto.exigeObservacao ?? false,
      notificaCliente: dto.notificaCliente ?? false,
      ativo: dto.ativo ?? true,
    };
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroMotivoRejeicao.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Motivo não encontrado.');
    return row;
  }

  private toShape(row: {
    id: string;
    codigo: string;
    descricao: string;
    tipo: string;
    exigeObservacao: boolean;
    notificaCliente: boolean;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      codigo: row.codigo,
      descricao: row.descricao,
      tipo: row.tipo,
      exigeObservacao: row.exigeObservacao,
      notificaCliente: row.notificaCliente,
      ativo: row.ativo,
    };
  }
}
