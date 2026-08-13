import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosTipoOperacaoFormDto } from './dto/cadastros-tipo-operacao-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosTiposOperacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.cadastroTipoOperacao.findMany({
      where: { deletedAt: null },
      orderBy: { codigo: 'asc' },
    });
    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    return this.toShape(await this.getRowOrThrow(id));
  }

  async create(dto: CadastrosTipoOperacaoFormDto) {
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroTipoOperacao.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroTipoOperacao.create({
      data: this.toData(dto, codigo),
    });
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosTipoOperacaoFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroTipoOperacao.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null, NOT: { id } },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroTipoOperacao.update({
      where: { id },
      data: {
        ...this.toData(dto, codigo),
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    return this.toShape(row);
  }

  private toData(dto: CadastrosTipoOperacaoFormDto, codigo: string) {
    return {
      tenantId: DEFAULT_TENANT,
      codigo,
      nome: dto.nome.trim(),
      descricao: dto.descricao?.trim() || null,
      direcao: dto.direcao ?? 'ENTRADA',
      exigeContainer: dto.exigeContainer ?? true,
      exigeCaminhao: dto.exigeCaminhao ?? true,
      exigeEmpilhadeira: dto.exigeEmpilhadeira ?? true,
      tempoPadrao: dto.tempoPadrao ?? null,
      centroCustoPadrao: dto.centroCustoPadrao?.trim() || null,
      cor: dto.cor ?? '#3B82F6',
      ativo: dto.ativo ?? true,
    };
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroTipoOperacao.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Tipo de operação não encontrado.');
    return row;
  }

  private toShape(row: {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    direcao: string;
    exigeContainer: boolean;
    exigeCaminhao: boolean;
    exigeEmpilhadeira: boolean;
    tempoPadrao: number | null;
    centroCustoPadrao: string | null;
    cor: string;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      descricao: row.descricao,
      direcao: row.direcao,
      exigeContainer: row.exigeContainer,
      exigeCaminhao: row.exigeCaminhao,
      exigeEmpilhadeira: row.exigeEmpilhadeira,
      tempoPadrao: row.tempoPadrao,
      centroCustoPadrao: row.centroCustoPadrao,
      cor: row.cor,
      ativo: row.ativo,
    };
  }
}
