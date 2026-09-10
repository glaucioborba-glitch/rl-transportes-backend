import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeTamanhoAluguel } from '../aluguel/aluguel-pricing.util';
import {
  CadastrosTabelaAluguelFormDto,
  CadastrosTabelaAluguelItemFormDto,
} from './dto/cadastros-tabela-aluguel-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosTabelasAluguelService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.cadastroTabelaAluguel.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { itens: { where: { deletedAt: null } } } } },
      orderBy: [{ padrao: 'desc' }, { dataInicio: 'desc' }, { nome: 'asc' }],
    });
    return { items: rows.map((r) => this.toListShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    const row = await this.getTabelaOrThrow(id);
    return {
      ...this.toListShape(row),
      dataFim: row.dataFim ? this.formatDate(row.dataFim) : '',
    };
  }

  async listItens(tabelaId: string) {
    await this.getTabelaOrThrow(tabelaId);
    const rows = await this.prisma.cadastroTabelaAluguelItem.findMany({
      where: { tabelaId, deletedAt: null },
      orderBy: [{ tipoContainerCodigo: 'asc' }, { containerTamanho: 'asc' }],
    });
    return { items: rows.map((r) => this.toItemShape(r)), total: rows.length };
  }

  async create(dto: CadastrosTabelaAluguelFormDto) {
    const row = await this.prisma.$transaction(async (tx) => {
      const tabela = await tx.cadastroTabelaAluguel.create({ data: this.toTabelaData(dto) });
      if (dto.padrao) await this.unsetOutrosPadroes(tx, tabela.id);
      return tabela;
    });
    return this.findOne(row.id);
  }

  async update(id: string, dto: CadastrosTabelaAluguelFormDto) {
    await this.getTabelaOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.cadastroTabelaAluguel.update({
        where: { id },
        data: {
          ...this.toTabelaData(dto),
          deletedAt: dto.ativo === false ? new Date() : null,
        },
      });
      if (dto.padrao) await this.unsetOutrosPadroes(tx, id);
    });
    return this.findOne(id);
  }

  async createItem(tabelaId: string, dto: CadastrosTabelaAluguelItemFormDto) {
    await this.getTabelaOrThrow(tabelaId);
    const tipo = dto.tipoContainerCodigo.trim().toUpperCase();
    const tamanho = normalizeTamanhoAluguel(dto.containerTamanho);
    await this.assertComboUnico(tabelaId, tipo, tamanho);
    const row = await this.prisma.cadastroTabelaAluguelItem.create({
      data: this.toItemData(tabelaId, dto, tipo, tamanho),
    });
    return this.toItemShape(row);
  }

  async updateItem(tabelaId: string, itemId: string, dto: CadastrosTabelaAluguelItemFormDto) {
    await this.getTabelaOrThrow(tabelaId);
    const existing = await this.prisma.cadastroTabelaAluguelItem.findFirst({
      where: { id: itemId, tabelaId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Item de aluguel não encontrado.');
    const tipo = dto.tipoContainerCodigo.trim().toUpperCase();
    const tamanho = normalizeTamanhoAluguel(dto.containerTamanho);
    await this.assertComboUnico(tabelaId, tipo, tamanho, itemId);
    const row = await this.prisma.cadastroTabelaAluguelItem.update({
      where: { id: itemId },
      data: {
        ...this.toItemData(tabelaId, dto, tipo, tamanho),
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    return this.toItemShape(row);
  }

  async resolveTabelaVigente(tenantId = DEFAULT_TENANT) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return this.prisma.cadastroTabelaAluguel.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        ativo: true,
        dataInicio: { lte: hoje },
        OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
      },
      include: { itens: { where: { deletedAt: null, ativo: true } } },
      orderBy: [{ padrao: 'desc' }, { dataInicio: 'desc' }],
    });
  }

  private toTabelaData(dto: CadastrosTabelaAluguelFormDto) {
    return {
      tenantId: DEFAULT_TENANT,
      nome: dto.nome.trim(),
      descricao: dto.descricao?.trim() || null,
      dataInicio: dto.dataInicio ? new Date(`${dto.dataInicio.slice(0, 10)}T12:00:00.000Z`) : new Date(),
      dataFim: dto.dataFim ? new Date(`${dto.dataFim.slice(0, 10)}T12:00:00.000Z`) : null,
      ativo: dto.ativo ?? true,
      padrao: dto.padrao ?? false,
    };
  }

  private toItemData(
    tabelaId: string,
    dto: CadastrosTabelaAluguelItemFormDto,
    tipo: string,
    tamanho: string,
  ) {
    return {
      tabelaId,
      tipoContainerCodigo: tipo,
      containerTamanho: tamanho,
      valorDiaria: new Prisma.Decimal(Number(dto.valorDiaria).toFixed(2)),
      diasFreeTime: dto.diasFreeTime ?? 0,
      valorEntrega: new Prisma.Decimal(Number(dto.valorEntrega ?? 0).toFixed(2)),
      valorColeta: new Prisma.Decimal(Number(dto.valorColeta ?? 0).toFixed(2)),
      ativo: dto.ativo ?? true,
    };
  }

  private async unsetOutrosPadroes(tx: Prisma.TransactionClient, keepId: string) {
    await tx.cadastroTabelaAluguel.updateMany({
      where: { tenantId: DEFAULT_TENANT, padrao: true, NOT: { id: keepId } },
      data: { padrao: false },
    });
  }

  private async assertComboUnico(
    tabelaId: string,
    tipo: string,
    tamanho: string,
    excludeId?: string,
  ) {
    const dup = await this.prisma.cadastroTabelaAluguelItem.findFirst({
      where: {
        tabelaId,
        tipoContainerCodigo: tipo,
        containerTamanho: tamanho,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (dup) {
      throw new ConflictException(`Já existe item para ${tipo} ${tamanho} nesta tabela.`);
    }
  }

  private async getTabelaOrThrow(id: string) {
    const row = await this.prisma.cadastroTabelaAluguel.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Tabela de aluguel não encontrada.');
    return row;
  }

  private formatDate(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  private toListShape(row: {
    id: string;
    nome: string;
    descricao: string | null;
    dataInicio: Date;
    dataFim: Date | null;
    ativo: boolean;
    padrao: boolean;
    _count?: { itens: number };
  }) {
    return {
      id: row.id,
      nome: row.nome,
      descricao: row.descricao,
      dataInicio: this.formatDate(row.dataInicio),
      dataFim: row.dataFim ? this.formatDate(row.dataFim) : null,
      ativo: row.ativo,
      padrao: row.padrao,
      qtdItens: row._count?.itens ?? 0,
    };
  }

  private toItemShape(row: {
    id: string;
    tabelaId: string;
    tipoContainerCodigo: string;
    containerTamanho: string;
    valorDiaria: Prisma.Decimal;
    diasFreeTime: number;
    valorEntrega: Prisma.Decimal;
    valorColeta: Prisma.Decimal;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      tabelaId: row.tabelaId,
      tipoContainerCodigo: row.tipoContainerCodigo,
      containerTamanho: row.containerTamanho,
      valorDiaria: Number(row.valorDiaria),
      diasFreeTime: row.diasFreeTime,
      valorEntrega: Number(row.valorEntrega),
      valorColeta: Number(row.valorColeta),
      ativo: row.ativo,
    };
  }
}
