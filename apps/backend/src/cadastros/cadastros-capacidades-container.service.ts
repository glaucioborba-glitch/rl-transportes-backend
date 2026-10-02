import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosCapacidadeContainerFormDto } from './dto/cadastros-capacidade-container-form.dto';
import { CadastrosCapacidadeContainerQueryDto } from './dto/cadastros-capacidade-container-query.dto';

@Injectable()
export class CadastrosCapacidadesContainerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CadastrosCapacidadeContainerQueryDto) {
    const where: Prisma.CadastroCapacidadeContainerWhereInput = { deletedAt: null };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.cadastroCapacidadeContainer.findMany({
      where,
      orderBy: { codigo: 'asc' },
    });

    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    return this.toShape(await this.getRowOrThrow(id));
  }

  async create(dto: CadastrosCapacidadeContainerFormDto) {
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroCapacidadeContainer.findFirst({
      where: { codigo, deletedAt: null },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroCapacidadeContainer.create({
      data: {
        codigo,
        nome: dto.nome.trim(),
        ativo: dto.ativo ?? true,
      },
    });
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosCapacidadeContainerFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroCapacidadeContainer.findFirst({
      where: { codigo, deletedAt: null, NOT: { id } },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroCapacidadeContainer.update({
      where: { id },
      data: {
        codigo,
        nome: dto.nome.trim(),
        ativo: dto.ativo ?? true,
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    return this.toShape(row);
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroCapacidadeContainer.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Capacidade não encontrada.');
    return row;
  }

  private toShape(row: { id: string; codigo: string; nome: string; ativo: boolean }) {
    return { id: row.id, codigo: row.codigo, nome: row.nome, ativo: row.ativo };
  }
}
