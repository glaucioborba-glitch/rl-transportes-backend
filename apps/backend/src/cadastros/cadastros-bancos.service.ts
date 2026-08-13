import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosBancoFormDto } from './dto/cadastros-banco-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosBancosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search?: string) {
    const q = search?.trim();
    const rows = await this.prisma.cadastroBanco.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { codigo: { contains: q, mode: 'insensitive' } },
                { nome: { contains: q, mode: 'insensitive' } },
                { cnpj: { contains: q.replace(/\D/g, '') } },
              ],
            }
          : {}),
      },
      orderBy: { codigo: 'asc' },
    });
    return {
      items: rows.map((r) => this.toShape(r)),
      total: rows.length,
    };
  }

  async findOne(id: string) {
    return this.toShape(await this.getRowOrThrow(id));
  }

  async create(dto: CadastrosBancoFormDto) {
    const codigo = dto.codigo.trim();
    await this.assertCodigoUnico(codigo);
    const row = await this.prisma.cadastroBanco.create({
      data: this.toData(dto, codigo),
    });
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosBancoFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim();
    await this.assertCodigoUnico(codigo, id);
    const row = await this.prisma.cadastroBanco.update({
      where: { id },
      data: {
        ...this.toData(dto, codigo),
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    return this.toShape(row);
  }

  private toData(dto: CadastrosBancoFormDto, codigo: string) {
    return {
      tenantId: DEFAULT_TENANT,
      codigo,
      nome: dto.nome.trim(),
      cnpj: dto.cnpj?.replace(/\D/g, '') || null,
      site: dto.site?.trim() || null,
      ativo: dto.ativo ?? true,
    };
  }

  private async assertCodigoUnico(codigo: string, excludeId?: string) {
    const dup = await this.prisma.cadastroBanco.findFirst({
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
    const row = await this.prisma.cadastroBanco.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Banco não encontrado.');
    return row;
  }

  private toShape(row: {
    id: string;
    codigo: string;
    nome: string;
    cnpj: string | null;
    site: string | null;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      cnpj: row.cnpj,
      site: row.site,
      ativo: row.ativo,
      contasVinculadas: 0,
    };
  }
}
