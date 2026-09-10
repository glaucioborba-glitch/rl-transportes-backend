import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosTabelaTransporteFormDto } from './dto/cadastros-tabela-transporte-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosTabelasTransporteService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.cadastroTabelaTransporte.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { itens: { where: { deletedAt: null } } } } },
      orderBy: [{ padrao: 'desc' }, { dataInicio: 'desc' }, { nome: 'asc' }],
    });
    return { items: rows.map((r) => this.toListShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return {
      ...this.toListShape(row),
      dataFim: row.dataFim ? this.formatDate(row.dataFim) : '',
    };
  }

  async create(dto: CadastrosTabelaTransporteFormDto) {
    const origem = dto.duplicarDeId ? await this.getRowOrThrow(dto.duplicarDeId) : null;
    const row = await this.prisma.$transaction(async (tx) => {
      const tabela = await tx.cadastroTabelaTransporte.create({
        data: this.toTabelaData(dto),
      });
      if (dto.padrao) {
        await this.unsetOutrosPadroes(tx, tabela.id);
      }
      if (origem) {
        const trechos = await tx.cadastroTarifaTransporte.findMany({
          where: { tabelaId: origem.id, deletedAt: null },
        });
        if (trechos.length) {
          await tx.cadastroTarifaTransporte.createMany({
            data: trechos.map((t) => ({
              tenantId: tabela.tenantId,
              tabelaId: tabela.id,
              localAId: t.localAId,
              localBId: t.localBId,
              statusCarga: t.statusCarga,
              tipoContainerCodigo: t.tipoContainerCodigo,
              retorno: t.retorno,
              valor: t.valor,
              valorPagoTerceiro: t.valorPagoTerceiro,
              observacao: t.observacao,
              ativo: t.ativo,
            })),
          });
        }
      }
      return tabela;
    });
    return this.findOne(row.id);
  }

  async update(id: string, dto: CadastrosTabelaTransporteFormDto) {
    await this.getRowOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.cadastroTabelaTransporte.update({
        where: { id },
        data: {
          ...this.toTabelaData(dto),
          deletedAt: dto.ativo === false ? new Date() : null,
        },
      });
      if (dto.padrao) {
        await this.unsetOutrosPadroes(tx, id);
      }
    });
    return this.findOne(id);
  }

  private async unsetOutrosPadroes(tx: Prisma.TransactionClient, keepId: string) {
    await tx.cadastroTabelaTransporte.updateMany({
      where: { tenantId: DEFAULT_TENANT, padrao: true, NOT: { id: keepId } },
      data: { padrao: false },
    });
  }

  private toTabelaData(dto: CadastrosTabelaTransporteFormDto) {
    return {
      tenantId: DEFAULT_TENANT,
      nome: dto.nome.trim(),
      descricao: dto.descricao?.trim() || null,
      dataInicio: dto.dataInicio?.trim() ? new Date(dto.dataInicio) : new Date(),
      dataFim: dto.dataFim?.trim() ? new Date(dto.dataFim) : null,
      ativo: dto.ativo ?? true,
      padrao: dto.padrao ?? false,
    };
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroTabelaTransporte.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { itens: { where: { deletedAt: null } } } } },
    });
    if (!row) throw new NotFoundException('Tabela de transportes não encontrada.');
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
      itensCount: row._count?.itens ?? 0,
    };
  }
}
