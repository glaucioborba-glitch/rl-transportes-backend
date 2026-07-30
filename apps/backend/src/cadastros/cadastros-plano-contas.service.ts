import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosPlanoContasFormDto } from './dto/cadastros-plano-contas-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosPlanoContasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tipo?: string) {
    const rows = await this.prisma.cadastroPlanoContas.findMany({
      where: {
        deletedAt: null,
        ...(tipo ? { tipo: tipo.toUpperCase() } : {}),
      },
      orderBy: { codigo: 'asc' },
    });
    return {
      items: rows.map((r) => this.toShape(r)),
      total: rows.length,
    };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return { ...this.toShape(row), paiId: row.paiId ?? '' };
  }

  async create(dto: CadastrosPlanoContasFormDto) {
    const codigo = dto.codigo.trim();
    await this.assertCodigoUnico(codigo);
    const paiId = await this.resolvePaiId(dto.paiId, dto.tipo);
    const row = await this.prisma.cadastroPlanoContas.create({
      data: {
        tenantId: DEFAULT_TENANT,
        codigo,
        nome: dto.nome.trim(),
        natureza: (dto.natureza ?? 'RECEITA').toUpperCase(),
        tipo: (dto.tipo ?? 'ANALITICA').toUpperCase(),
        paiId,
        descricao: dto.descricao?.trim() || null,
        ativo: dto.ativo ?? true,
      },
    });
    return { ...this.toShape(row), paiId: row.paiId ?? '' };
  }

  async update(id: string, dto: CadastrosPlanoContasFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim();
    await this.assertCodigoUnico(codigo, id);
    if (dto.paiId === id) {
      throw new BadRequestException('Conta não pode ser pai de si mesma.');
    }
    const paiId = await this.resolvePaiId(dto.paiId, dto.tipo, id);
    const row = await this.prisma.cadastroPlanoContas.update({
      where: { id },
      data: {
        codigo,
        nome: dto.nome.trim(),
        natureza: (dto.natureza ?? 'RECEITA').toUpperCase(),
        tipo: (dto.tipo ?? 'ANALITICA').toUpperCase(),
        paiId,
        descricao: dto.descricao?.trim() || null,
        ativo: dto.ativo ?? true,
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    return { ...this.toShape(row), paiId: row.paiId ?? '' };
  }

  private async resolvePaiId(paiId?: string, tipo?: string, selfId?: string) {
    const clean = paiId?.trim();
    if (!clean) return null;
    const pai = await this.prisma.cadastroPlanoContas.findFirst({
      where: { id: clean, deletedAt: null },
    });
    if (!pai) throw new NotFoundException('Conta pai não encontrada.');
    if (selfId && pai.id === selfId) {
      throw new BadRequestException('Conta não pode ser pai de si mesma.');
    }
    if (pai.tipo !== 'SINTETICA') {
      throw new BadRequestException('A conta pai deve ser do tipo Sintética.');
    }
    return pai.id;
  }

  private async assertCodigoUnico(codigo: string, excludeId?: string) {
    const dup = await this.prisma.cadastroPlanoContas.findFirst({
      where: {
        tenantId: DEFAULT_TENANT,
        codigo,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroPlanoContas.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Conta não encontrada.');
    return row;
  }

  private toShape(row: {
    id: string;
    codigo: string;
    nome: string;
    natureza: string;
    tipo: string;
    paiId: string | null;
    descricao: string | null;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      natureza: row.natureza,
      tipo: row.tipo,
      paiId: row.paiId,
      descricao: row.descricao,
      ativo: row.ativo,
    };
  }
}
