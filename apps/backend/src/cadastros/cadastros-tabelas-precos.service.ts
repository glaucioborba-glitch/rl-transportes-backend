import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {

  CategoriaItemTabelaPreco,

  Prisma,

  StatusContainerTarifa,

} from '@prisma/client';

import { FAIXAS_DIARIA_PADRAO } from '../billing-engine/faixa-diaria-calculator';

import { PricingSyncService } from '../pricing-sync/pricing-sync.service';

import { PrismaService } from '../prisma/prisma.service';

import {
  formatTamanhoContainerMatrix,
  normalizeTamanhosContainer,
} from './tipo-container-tamanhos.util';
import {
  CadastrosTabelaPrecoFormDto,
  CadastrosTabelaPrecoItemDto,
} from './dto/cadastros-tabela-preco-form.dto';

const DEFAULT_TENANT = 'default';
const STATUS_ARMAZENAGEM = ['CHEIO', 'VAZIO'] as const;

@Injectable()
export class CadastrosTabelasPrecosService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly pricingSync: PricingSyncService,

  ) {}



  async list() {

    const rows = await this.prisma.cadastroTabelaPreco.findMany({

      where: { deletedAt: null },

      include: {

        cliente: { select: { id: true, razaoSocial: true } },

        _count: { select: { itens: true } },

      },

      orderBy: [{ padrao: 'desc' }, { dataInicio: 'desc' }, { nome: 'asc' }],

    });

    return {

      items: rows.map((r) => this.toListShape(r)),

      total: rows.length,

    };

  }



  async findOne(id: string) {

    const row = await this.getRowOrThrow(id);

    return {

      ...this.toFormShape(row),

      clienteId: row.clienteId ?? '',

      dataFim: row.dataFim ? this.formatDate(row.dataFim) : '',

      padrao: row.padrao,

      syncedAt: row.syncedAt?.toISOString() ?? null,

      billingTabelaPrecoId: row.billingTabelaPrecoId,

    };

  }



  async listItens(id: string) {

    await this.getRowOrThrow(id);

    const itens = await this.prisma.cadastroTabelaPrecoItem.findMany({

      where: { tabelaId: id },

      orderBy: [

        { categoriaItem: 'asc' },

        { tipoOperacaoCodigo: 'asc' },

        { tipoContainerCodigo: 'asc' },

      ],

    });

    return {

      items: itens.map((i) => this.toItemShape(i)),

      total: itens.length,

    };

  }



  async gerarMatrizCombinacoes() {
    const tipos = await this.prisma.cadastroTipoContainer.findMany({
      where: { tenantId: DEFAULT_TENANT, deletedAt: null, ativo: true },
      orderBy: { codigo: 'asc' },
    });

    const items: CadastrosTabelaPrecoItemDto[] = [];

    for (const tipo of tipos) {
      const tamanhos = normalizeTamanhosContainer(tipo.tamanhos);
      if (!tamanhos.length) continue;

      for (const tamanho of tamanhos) {
        const containerTamanho = formatTamanhoContainerMatrix(tamanho);
        for (const status of STATUS_ARMAZENAGEM) {
          items.push({
            categoriaItem: 'ARMAZENAGEM',
            tipoOperacaoCodigo: 'ARMAZENAGEM',
            tipoContainerCodigo: tipo.codigo,
            containerTamanho,
            statusContainer: status,
            valor: 0,
            valorHandling: 150,
            freeTimeDias: 7,
            faixasDiaria: FAIXAS_DIARIA_PADRAO.map((f) => ({ ...f })),
            tarifaEnergiaReeferDiaria: tipo.tomadaReefer ? 45 : undefined,
          });
        }
      }
    }

    return { items, total: items.length };
  }



  async syncBilling(id: string, actorUserId?: string) {

    await this.getRowOrThrow(id);

    return this.pricingSync.syncFromCadastro(id, actorUserId);

  }



  async findVigente(query: {

    clienteId?: string;

    tipoOperacao?: string;

    tipoContainer?: string;

    tamanho?: string;

  }) {

    const hoje = new Date();

    hoje.setHours(0, 0, 0, 0);



    const tabelas = await this.prisma.cadastroTabelaPreco.findMany({

      where: {

        tenantId: DEFAULT_TENANT,

        deletedAt: null,

        ativo: true,

        dataInicio: { lte: hoje },

        AND: [

          { OR: [{ dataFim: null }, { dataFim: { gte: hoje } }] },

          query.clienteId

            ? { OR: [{ clienteId: query.clienteId }, { clienteId: null }] }

            : { clienteId: null },

        ],

      },

      include: { itens: true, cliente: { select: { id: true, razaoSocial: true } } },

      orderBy: [{ clienteId: 'desc' }, { padrao: 'desc' }, { dataInicio: 'desc' }],

    });



    const tipoOp = query.tipoOperacao?.trim().toUpperCase();

    const tipoCont = query.tipoContainer?.trim().toUpperCase();

    const tamanho = query.tamanho?.trim();



    for (const tabela of tabelas) {

      const item = this.matchItem(tabela.itens, tipoOp, tipoCont, tamanho);

      if (item) {

        return {

          tabela: this.toListShape(tabela),

          item: this.toItemShape(item),

        };

      }

    }



    throw new NotFoundException('Nenhum preço vigente encontrado para os critérios informados.');

  }



  async create(dto: CadastrosTabelaPrecoFormDto, actorUserId?: string) {

    this.assertItens(dto.itens);

    await this.assertPadraoUnico(dto.padrao ?? false);

    const row = await this.prisma.$transaction(async (tx) => {

      const tabela = await tx.cadastroTabelaPreco.create({

        data: this.toTabelaData(dto),

      });

      if (dto.itens?.length) {

        await tx.cadastroTabelaPrecoItem.createMany({

          data: dto.itens.map((i) => this.toItemData(i, tabela.id)),

        });

      }

      if (dto.padrao) {

        await tx.cadastroTabelaPreco.updateMany({

          where: { tenantId: DEFAULT_TENANT, padrao: true, NOT: { id: tabela.id } },

          data: { padrao: false },

        });

      }

      return tabela;

    });

    await this.pricingSync.syncFromCadastro(row.id, actorUserId);

    return this.findOne(row.id);

  }



  async update(id: string, dto: CadastrosTabelaPrecoFormDto, actorUserId?: string) {

    await this.getRowOrThrow(id);

    if (dto.itens) this.assertItens(dto.itens);

    if (dto.padrao) await this.assertPadraoUnico(true, id);



    await this.prisma.$transaction(async (tx) => {

      await tx.cadastroTabelaPreco.update({

        where: { id },

        data: {

          ...this.toTabelaData(dto),

          deletedAt: dto.ativo === false ? new Date() : null,

        },

      });

      if (dto.padrao) {

        await tx.cadastroTabelaPreco.updateMany({

          where: { tenantId: DEFAULT_TENANT, padrao: true, NOT: { id } },

          data: { padrao: false },

        });

      }

      if (dto.itens) {

        await tx.cadastroTabelaPrecoItem.deleteMany({ where: { tabelaId: id } });

        await tx.cadastroTabelaPrecoItem.createMany({

          data: dto.itens.map((i) => this.toItemData(i, id)),

        });

      }

    });

    await this.pricingSync.syncFromCadastro(id, actorUserId);

    return this.findOne(id);

  }



  private async assertPadraoUnico(padrao: boolean, excludeId?: string) {

    if (!padrao) return;

    const existing = await this.prisma.cadastroTabelaPreco.findFirst({

      where: {

        tenantId: DEFAULT_TENANT,

        padrao: true,

        deletedAt: null,

        ...(excludeId ? { NOT: { id: excludeId } } : {}),

      },

    });

    if (existing) {

      throw new BadRequestException(

        `Já existe tabela padrão: "${existing.nome}". Desmarque-a antes de definir outra.`,

      );

    }

  }



  private matchItem(

    itens: Array<{

      categoriaItem: CategoriaItemTabelaPreco;

      tipoOperacaoCodigo: string;

      tipoContainerCodigo: string | null;

      containerTamanho: string | null;

      valor: Prisma.Decimal;

      unidade: string;

      valorMinimo: Prisma.Decimal | null;

    }>,

    tipoOp?: string,

    tipoCont?: string,

    tamanho?: string,

  ) {

    if (!tipoOp) return null;

    const candidates = itens.filter(

      (i) =>

        i.categoriaItem === CategoriaItemTabelaPreco.OPERACAO &&

        i.tipoOperacaoCodigo === tipoOp,

    );

    if (!candidates.length) return null;



    const score = (i: (typeof candidates)[0]) => {

      let s = 0;

      if (tipoCont) {

        if (i.tipoContainerCodigo === tipoCont) s += 4;

        else if (!i.tipoContainerCodigo || i.tipoContainerCodigo === '*') s += 1;

        else return -1;

      }

      if (tamanho) {

        if (i.containerTamanho === tamanho) s += 2;

        else if (!i.containerTamanho || i.containerTamanho === '*') s += 1;

        else return -1;

      }

      return s;

    };



    return candidates

      .map((i) => ({ i, s: score(i) })

      )

      .filter((x) => x.s >= 0)

      .sort((a, b) => b.s - a.s)[0]?.i;

  }



  private assertItens(itens?: CadastrosTabelaPrecoItemDto[]) {

    if (!itens?.length) {

      throw new BadRequestException('Adicione pelo menos 1 item à tabela.');

    }

    for (const item of itens) {

      const isArmazenagem =

        item.categoriaItem === 'ARMAZENAGEM' ||

        item.tipoOperacaoCodigo?.toUpperCase() === 'ARMAZENAGEM';



      if (isArmazenagem) {

        if (!item.tipoContainerCodigo?.trim()) {

          throw new BadRequestException('Tipo de contêiner obrigatório na matriz de armazenagem.');

        }

        continue;

      }



      if (!item.tipoOperacaoCodigo?.trim()) {

        throw new BadRequestException('Tipo de operação é obrigatório em todos os itens.');

      }

      if (item.valor == null || Number.isNaN(Number(item.valor))) {

        throw new BadRequestException('Valor inválido em um dos itens de operação.');

      }

    }

  }



  private toTabelaData(dto: CadastrosTabelaPrecoFormDto) {

    const clienteId = dto.clienteId?.trim();

    return {

      tenantId: DEFAULT_TENANT,

      nome: dto.nome.trim(),

      descricao: dto.descricao?.trim() || null,

      clienteId: clienteId || null,

      moeda: dto.moeda?.trim() || 'BRL',

      dataInicio: dto.dataInicio?.trim() ? new Date(dto.dataInicio) : new Date(),

      dataFim: dto.dataFim?.trim() ? new Date(dto.dataFim) : null,

      ativo: dto.ativo ?? true,

      padrao: dto.padrao ?? false,

    };

  }



  private toItemData(item: CadastrosTabelaPrecoItemDto, tabelaId: string) {

    const tc = item.tipoContainerCodigo?.trim();

    const cap = item.capacidadeCodigo?.trim();

    const tam = item.containerTamanho?.trim();

    const isArmazenagem =

      item.categoriaItem === 'ARMAZENAGEM' ||

      item.tipoOperacaoCodigo?.toUpperCase() === 'ARMAZENAGEM';



    return {

      tabelaId,

      categoriaItem: isArmazenagem

        ? CategoriaItemTabelaPreco.ARMAZENAGEM

        : CategoriaItemTabelaPreco.OPERACAO,

      tipoOperacaoCodigo: isArmazenagem

        ? 'ARMAZENAGEM'

        : item.tipoOperacaoCodigo.trim().toUpperCase(),

      tipoContainerCodigo: tc && tc !== '' ? tc.toUpperCase() : null,

      capacidadeCodigo: cap && cap !== '' && cap !== '*' ? cap.toUpperCase() : null,

      containerTamanho: tam && tam !== '' && tam !== '*' ? tam : tam === '*' ? '*' : null,

      valor: new Prisma.Decimal(item.valor ?? 0),

      unidade: item.unidade?.trim() || (isArmazenagem ? 'POR_CICLO' : 'POR_OPERACAO'),

      valorMinimo:

        item.valorMinimo != null && !Number.isNaN(Number(item.valorMinimo))

          ? new Prisma.Decimal(item.valorMinimo)

          : null,

      statusContainer: (item.statusContainer ?? 'AMBOS') as StatusContainerTarifa,

      valorHandling:

        item.valorHandling != null ? new Prisma.Decimal(item.valorHandling) : null,

      freeTimeDias: item.freeTimeDias ?? null,

      faixasDiaria: item.faixasDiaria?.length

        ? (JSON.parse(JSON.stringify(item.faixasDiaria)) as Prisma.InputJsonValue)

        : Prisma.JsonNull,

      tarifaDiariaArmazenagem:

        item.tarifaDiariaArmazenagem != null

          ? new Prisma.Decimal(item.tarifaDiariaArmazenagem)

          : null,

      tarifaEnergiaReeferDiaria:

        item.tarifaEnergiaReeferDiaria != null

          ? new Prisma.Decimal(item.tarifaEnergiaReeferDiaria)

          : null,

    };

  }



  private async getRowOrThrow(id: string) {

    const row = await this.prisma.cadastroTabelaPreco.findUnique({

      where: { id },

      include: {

        cliente: { select: { id: true, razaoSocial: true } },

        itens: true,

      },

    });

    if (!row || row.deletedAt) throw new NotFoundException('Tabela de preços não encontrada.');

    return row;

  }



  private formatDate(d: Date) {

    return d.toISOString().slice(0, 10);

  }



  private toListShape(row: {

    id: string;

    nome: string;

    descricao: string | null;

    moeda: string;

    dataInicio: Date;

    dataFim: Date | null;

    ativo: boolean;

    padrao?: boolean;

    syncedAt?: Date | null;

    cliente: { id: string; razaoSocial: string } | null;

    _count?: { itens: number };

    itens?: unknown[];

  }) {

    return {

      id: row.id,

      nome: row.nome,

      descricao: row.descricao,

      moeda: row.moeda,

      dataInicio: this.formatDate(row.dataInicio),

      dataFim: row.dataFim ? this.formatDate(row.dataFim) : null,

      ativo: row.ativo,

      padrao: row.padrao ?? false,

      syncedAt: row.syncedAt?.toISOString() ?? null,

      cliente: row.cliente ? { id: row.cliente.id, nome: row.cliente.razaoSocial } : null,

      itensCount: row._count?.itens ?? (Array.isArray(row.itens) ? row.itens.length : 0),

    };

  }



  private toFormShape(row: {

    id: string;

    nome: string;

    descricao: string | null;

    moeda: string;

    dataInicio: Date;

    dataFim: Date | null;

    ativo: boolean;

    padrao?: boolean;

  }) {

    return {

      id: row.id,

      nome: row.nome,

      descricao: row.descricao ?? '',

      moeda: row.moeda,

      dataInicio: this.formatDate(row.dataInicio),

      ativo: row.ativo,

      padrao: row.padrao ?? false,

    };

  }



  private toItemShape(row: {

    id?: string;

    categoriaItem?: CategoriaItemTabelaPreco;

    tipoOperacaoCodigo: string;

    tipoContainerCodigo: string | null;

    capacidadeCodigo?: string | null;

    containerTamanho: string | null;

    valor: Prisma.Decimal;

    unidade: string;

    valorMinimo: Prisma.Decimal | null;

    statusContainer?: StatusContainerTarifa;

    valorHandling?: Prisma.Decimal | null;

    freeTimeDias?: number | null;

    faixasDiaria?: unknown;

    tarifaDiariaArmazenagem?: Prisma.Decimal | null;

    tarifaEnergiaReeferDiaria?: Prisma.Decimal | null;

  }) {

    return {

      id: row.id,

      categoriaItem: row.categoriaItem ?? 'OPERACAO',

      tipoOperacaoCodigo: row.tipoOperacaoCodigo,

      tipoContainerCodigo: row.tipoContainerCodigo ?? '',

      capacidadeCodigo: row.capacidadeCodigo ?? '',

      containerTamanho: row.containerTamanho ?? "20'",

      valor: Number(row.valor),

      unidade: row.unidade,

      valorMinimo: row.valorMinimo != null ? Number(row.valorMinimo) : '',

      statusContainer: row.statusContainer ?? 'AMBOS',

      valorHandling: row.valorHandling != null ? Number(row.valorHandling) : null,

      freeTimeDias: row.freeTimeDias ?? null,

      faixasDiaria: Array.isArray(row.faixasDiaria) ? row.faixasDiaria : [],

      tarifaDiariaArmazenagem:

        row.tarifaDiariaArmazenagem != null ? Number(row.tarifaDiariaArmazenagem) : null,

      tarifaEnergiaReeferDiaria:

        row.tarifaEnergiaReeferDiaria != null ? Number(row.tarifaEnergiaReeferDiaria) : null,

    };

  }

}


