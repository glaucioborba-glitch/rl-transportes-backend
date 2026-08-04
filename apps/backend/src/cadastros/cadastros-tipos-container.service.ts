import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosTipoContainerFormDto } from './dto/cadastros-tipo-container-form.dto';
import { CadastrosTipoContainerQueryDto } from './dto/cadastros-tipo-container-query.dto';
import { normalizeTamanhosContainer } from './tipo-container-tamanhos.util';

@Injectable()
export class CadastrosTiposContainerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CadastrosTipoContainerQueryDto, _actor: AuthUser) {
    const where: Prisma.CadastroTipoContainerWhereInput = { deletedAt: null };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.cadastroTipoContainer.findMany({
      where,
      orderBy: { codigo: 'asc' },
    });

    return {
      items: rows.map((r) => this.toShape(r)),
      total: rows.length,
    };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return this.toShape(row);
  }

  async create(dto: CadastrosTipoContainerFormDto) {
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroTipoContainer.findFirst({
      where: { codigo, deletedAt: null },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroTipoContainer.create({
      data: {
        codigo,
        nome: dto.nome.trim(),
        tamanhos: normalizeTamanhosContainer(dto.tamanhos),
        tomadaReefer: dto.tomadaReefer ?? false,
        ativo: dto.ativo ?? true,
      },
    });
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosTipoContainerFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroTipoContainer.findFirst({
      where: { codigo, deletedAt: null, NOT: { id } },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroTipoContainer.update({
      where: { id },
      data: {
        codigo,
        nome: dto.nome.trim(),
        tamanhos: normalizeTamanhosContainer(dto.tamanhos),
        tomadaReefer: dto.tomadaReefer ?? false,
        ativo: dto.ativo ?? true,
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    return this.toShape(row);
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroTipoContainer.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Tipo de contêiner não encontrado.');
    return row;
  }

  private toShape(row: {
    id: string;
    codigo: string;
    nome: string;
    tamanhos: unknown;
    tomadaReefer: boolean;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      tamanhos: normalizeTamanhosContainer(row.tamanhos),
      tomadaReefer: row.tomadaReefer,
      ativo: row.ativo,
    };
  }
}
