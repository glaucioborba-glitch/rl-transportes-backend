import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CadastrosServicoItemFormDto,
  CadastrosTabelaServicoFormDto,
} from './dto/cadastros-tabela-servico-form.dto';
import { parseEfeitoConfig, parseServicoEfeito } from './servico-efeito';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosTabelasServicosService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.cadastroTabelaServico.findMany({
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
    const rows = await this.prisma.cadastroServicoItem.findMany({
      where: { tabelaId, deletedAt: null },
      orderBy: { codigo: 'asc' },
    });
    return { items: rows.map((r) => this.toItemShape(r)), total: rows.length };
  }

  async listCatalogoAtivo(
    tenantId = DEFAULT_TENANT,
    opts?: { tabelaId?: string | null; clienteId?: string | null },
  ): Promise<{ tabelaId: string | null; items: ReturnType<CadastrosTabelasServicosService['toItemShape']>[] }> {
    let tabelaId = opts?.tabelaId?.trim() || null;
    if (!tabelaId && opts?.clienteId) {
      const cliente = await this.prisma.cliente.findFirst({
        where: { id: opts.clienteId, deletedAt: null },
        select: { cadastroTabelaServicoId: true },
      });
      tabelaId = cliente?.cadastroTabelaServicoId ?? null;
    }
    const tabela = tabelaId
      ? await this.prisma.cadastroTabelaServico.findFirst({
          where: { id: tabelaId, deletedAt: null, ativo: true },
        })
      : await this.resolveTabelaVigente(tenantId);
    if (!tabela) return { tabelaId: null, items: [] };
    const rows = await this.prisma.cadastroServicoItem.findMany({
      where: { tabelaId: tabela.id, deletedAt: null, ativo: true },
      orderBy: { nome: 'asc' },
    });
    return { tabelaId: tabela.id, items: rows.map((r) => this.toItemShape(r)) };
  }

  async create(dto: CadastrosTabelaServicoFormDto) {
    const row = await this.prisma.$transaction(async (tx) => {
      const tabela = await tx.cadastroTabelaServico.create({ data: this.toTabelaData(dto) });
      if (dto.padrao) await this.unsetOutrosPadroes(tx, tabela.id);
      return tabela;
    });
    return this.findOne(row.id);
  }

  async update(id: string, dto: CadastrosTabelaServicoFormDto) {
    await this.getTabelaOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.cadastroTabelaServico.update({
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

  async createItem(tabelaId: string, dto: CadastrosServicoItemFormDto) {
    await this.getTabelaOrThrow(tabelaId);
    const codigo = dto.codigo.trim().toUpperCase();
    await this.assertCodigoUnico(tabelaId, codigo);
    const row = await this.prisma.cadastroServicoItem.create({
      data: {
        tabelaId,
        codigo,
        nome: dto.nome.trim(),
        valor: new Prisma.Decimal(dto.valor.toFixed(2)),
        unidade: dto.unidade?.trim() || 'POR_UNIDADE',
        ativo: dto.ativo ?? true,
        ...this.toEfeitoData(dto),
      },
    });
    return this.toItemShape(row);
  }

  async updateItem(tabelaId: string, itemId: string, dto: CadastrosServicoItemFormDto) {
    await this.getTabelaOrThrow(tabelaId);
    const existing = await this.prisma.cadastroServicoItem.findFirst({
      where: { id: itemId, tabelaId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Serviço não encontrado.');
    const codigo = dto.codigo.trim().toUpperCase();
    await this.assertCodigoUnico(tabelaId, codigo, itemId);
    const row = await this.prisma.cadastroServicoItem.update({
      where: { id: itemId },
      data: {
        codigo,
        nome: dto.nome.trim(),
        valor: new Prisma.Decimal(dto.valor.toFixed(2)),
        unidade: dto.unidade?.trim() || 'POR_UNIDADE',
        ativo: dto.ativo ?? true,
        deletedAt: dto.ativo === false ? new Date() : null,
        ...this.toEfeitoData(dto),
      },
    });
    return this.toItemShape(row);
  }

  private async resolveTabelaVigente(tenantId: string) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return this.prisma.cadastroTabelaServico.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        ativo: true,
        dataInicio: { lte: hoje },
        OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
      },
      orderBy: [{ padrao: 'desc' }, { dataInicio: 'desc' }],
    });
  }

  private toTabelaData(dto: CadastrosTabelaServicoFormDto) {
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

  private async unsetOutrosPadroes(tx: Prisma.TransactionClient, keepId: string) {
    await tx.cadastroTabelaServico.updateMany({
      where: { tenantId: DEFAULT_TENANT, padrao: true, NOT: { id: keepId } },
      data: { padrao: false },
    });
  }

  private async assertCodigoUnico(tabelaId: string, codigo: string, excludeId?: string) {
    const dup = await this.prisma.cadastroServicoItem.findFirst({
      where: {
        tabelaId,
        codigo,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (dup) throw new ConflictException(`Código já cadastrado nesta tabela: ${codigo}.`);
  }

  private async getTabelaOrThrow(id: string) {
    const row = await this.prisma.cadastroTabelaServico.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Tabela de serviços não encontrada.');
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

  private toEfeitoData(dto: CadastrosServicoItemFormDto) {
    const efeito = parseServicoEfeito(dto.efeito);
    const efeitoConfig = parseEfeitoConfig({
      servicoLacreTerminalCodigo: dto.servicoLacreTerminalCodigo,
      observacaoRic: dto.observacaoRic,
    });
    return {
      efeito,
      efeitoConfig: Object.keys(efeitoConfig).length ? (efeitoConfig as Prisma.InputJsonValue) : Prisma.JsonNull,
    };
  }

  private toItemShape(row: {
    id: string;
    tabelaId: string;
    codigo: string;
    nome: string;
    valor: Prisma.Decimal | number;
    unidade: string;
    ativo: boolean;
    efeito?: string;
    efeitoConfig?: unknown;
  }) {
    const config = parseEfeitoConfig(row.efeitoConfig);
    return {
      id: row.id,
      tabelaId: row.tabelaId,
      codigo: row.codigo,
      nome: row.nome,
      valor: Number(row.valor),
      unidade: row.unidade,
      ativo: row.ativo,
      efeito: parseServicoEfeito(row.efeito),
      servicoLacreTerminalCodigo: config.servicoLacreTerminalCodigo ?? '',
      observacaoRic: config.observacaoRic ?? '',
    };
  }
}
