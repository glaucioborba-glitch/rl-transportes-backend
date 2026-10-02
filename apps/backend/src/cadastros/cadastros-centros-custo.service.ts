import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosCentroCustoFormDto } from './dto/cadastros-centro-custo-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosCentrosCustoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tipo?: string) {
    const rows = await this.prisma.cadastroCentroCusto.findMany({
      where: {
        deletedAt: null,
        ...(tipo ? { tipo: tipo.toUpperCase() } : {}),
      },
      orderBy: { codigo: 'asc' },
    });

    const codigos = rows.map((r) => r.codigo);
    const [colabCounts, equipCounts] = await Promise.all([
      this.prisma.cadastroColaborador.groupBy({
        by: ['centroCustoCodigo'],
        where: { centroCustoCodigo: { in: codigos } },
        _count: { _all: true },
      }),
      this.prisma.cadastroEquipamento.groupBy({
        by: ['centroCusto'],
        where: { centroCusto: { in: codigos }, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const colabMap = new Map(
      colabCounts.map((c) => [c.centroCustoCodigo ?? '', c._count._all]),
    );
    const equipMap = new Map(
      equipCounts.map((e) => [e.centroCusto ?? '', e._count._all]),
    );

    return {
      items: rows.map((r) => ({
        ...this.toShape(r),
        colaboradoresVinculados: colabMap.get(r.codigo) ?? 0,
        equipamentosVinculados: equipMap.get(r.codigo) ?? 0,
      })),
      total: rows.length,
    };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return {
      ...this.toShape(row),
      paiId: row.paiId ?? '',
    };
  }

  async create(dto: CadastrosCentroCustoFormDto) {
    const codigo = dto.codigo.trim().toUpperCase();
    await this.assertCodigoUnico(codigo);
    const paiId = await this.resolvePaiId(dto.paiId, dto.tipo);
    const row = await this.prisma.cadastroCentroCusto.create({
      data: {
        tenantId: DEFAULT_TENANT,
        codigo,
        nome: dto.nome.trim(),
        tipo: (dto.tipo ?? 'ANALITICO').toUpperCase(),
        paiId,
        descricao: dto.descricao?.trim() || null,
        ativo: dto.ativo ?? true,
      },
    });
    return { ...this.toShape(row), paiId: row.paiId ?? '' };
  }

  async update(id: string, dto: CadastrosCentroCustoFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    await this.assertCodigoUnico(codigo, id);
    if (dto.paiId === id) {
      throw new BadRequestException('Centro de custo não pode ser pai de si mesmo.');
    }
    const paiId = await this.resolvePaiId(dto.paiId, dto.tipo, id);
    const row = await this.prisma.cadastroCentroCusto.update({
      where: { id },
      data: {
        codigo,
        nome: dto.nome.trim(),
        tipo: (dto.tipo ?? 'ANALITICO').toUpperCase(),
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
    const pai = await this.prisma.cadastroCentroCusto.findFirst({
      where: { id: clean, deletedAt: null },
    });
    if (!pai) throw new NotFoundException('Centro de custo pai não encontrado.');
    if (selfId && pai.id === selfId) {
      throw new BadRequestException('Centro de custo não pode ser pai de si mesmo.');
    }
    if (pai.tipo !== 'SINTETICO') {
      throw new BadRequestException('O centro pai deve ser do tipo Sintético.');
    }
    if ((tipo ?? 'ANALITICO').toUpperCase() === 'SINTETICO' && pai.paiId) {
      // allow nested sintéticos
    }
    return pai.id;
  }

  private async assertCodigoUnico(codigo: string, excludeId?: string) {
    const dup = await this.prisma.cadastroCentroCusto.findFirst({
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
    const row = await this.prisma.cadastroCentroCusto.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Centro de custo não encontrado.');
    return row;
  }

  private toShape(row: {
    id: string;
    codigo: string;
    nome: string;
    tipo: string;
    paiId: string | null;
    descricao: string | null;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      tipo: row.tipo,
      paiId: row.paiId,
      descricao: row.descricao,
      ativo: row.ativo,
    };
  }
}
