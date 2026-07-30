import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CadastrosPosicaoPatioDisponiveisQueryDto,
  CadastrosPosicaoPatioFormDto,
} from './dto/cadastros-posicao-patio-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosPosicoesPatioService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.cadastroPosicaoPatio.findMany({
      where: { deletedAt: null },
      orderBy: [{ zonaCodigo: 'asc' }, { baiaCodigo: 'asc' }, { slotNumero: 'asc' }, { stackAltura: 'asc' }],
    });
    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  async listZonas() {
    const rows = await this.prisma.posicaoPatioZona.findMany({
      where: { deletedAt: null, ativo: true },
      orderBy: { codigo: 'asc' },
    });
    return { items: rows.map((z) => ({ id: z.id, codigo: z.codigo, nome: z.nome, cor: z.cor })), total: rows.length };
  }

  async listDisponiveis(query: CadastrosPosicaoPatioDisponiveisQueryDto) {
    const where: Prisma.CadastroPosicaoPatioWhereInput = {
      deletedAt: null,
      ativo: true,
      status: 'LIVRE',
    };
    const tipo = query.tipo?.trim().toUpperCase();
    if (tipo && tipo !== 'MISTO') {
      where.OR = [{ tipoAceito: 'MISTO' }, { tipoAceito: tipo }];
    }
    const rows = await this.prisma.cadastroPosicaoPatio.findMany({
      where,
      orderBy: [{ zonaCodigo: 'asc' }, { baiaCodigo: 'asc' }, { slotNumero: 'asc' }],
    });
    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return this.toShape(row);
  }

  async create(dto: CadastrosPosicaoPatioFormDto) {
    const { zona, baia } = await this.resolveZonaBaia(dto);
    const codigo = this.buildCodigo(dto.baiaCodigo, dto.slotNumero, dto.stackAltura ?? 1);
    const dup = await this.prisma.cadastroPosicaoPatio.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null },
    });
    if (dup) throw new ConflictException(`Posição já cadastrada: ${codigo}.`);

    const row = await this.prisma.cadastroPosicaoPatio.create({
      data: this.buildData(dto, zona, baia, codigo),
    });
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosPosicaoPatioFormDto) {
    await this.getRowOrThrow(id);
    const { zona, baia } = await this.resolveZonaBaia(dto);
    const codigo = this.buildCodigo(dto.baiaCodigo, dto.slotNumero, dto.stackAltura ?? 1);
    const dup = await this.prisma.cadastroPosicaoPatio.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null, NOT: { id } },
    });
    if (dup) throw new ConflictException(`Posição já cadastrada: ${codigo}.`);

    const row = await this.prisma.cadastroPosicaoPatio.update({
      where: { id },
      data: {
        ...this.buildData(dto, zona, baia, codigo),
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    return this.toShape(row);
  }

  private buildCodigo(baiaCodigo: string, slotNumero: number, stackAltura: number) {
    return `${baiaCodigo}-${String(slotNumero).padStart(2, '0')}-${stackAltura}`;
  }

  private buildData(
    dto: CadastrosPosicaoPatioFormDto,
    zona: { id: string; codigo: string; nome: string; cor: string },
    baia: { id: string; codigo: string },
    codigo: string,
  ): Prisma.CadastroPosicaoPatioCreateInput {
    return {
      tenant: { connect: { id: DEFAULT_TENANT } },
      zona: { connect: { id: zona.id } },
      baia: { connect: { id: baia.id } },
      codigo,
      zonaCodigo: zona.codigo,
      baiaCodigo: baia.codigo,
      zonaNome: zona.nome,
      zonaCor: zona.cor,
      slotNumero: dto.slotNumero,
      stackAltura: dto.stackAltura ?? 1,
      tipoAceito: dto.tipoAceito ?? 'MISTO',
      tomadaReefer: dto.tomadaReefer ?? false,
      capacidadePeso: dto.capacidadePeso != null ? dto.capacidadePeso : null,
      status: dto.status ?? 'LIVRE',
      restricoes: dto.restricoes?.trim() || null,
      containerAtual: dto.containerAtual?.trim() || null,
      ativo: dto.ativo ?? true,
    };
  }

  private async resolveZonaBaia(dto: CadastrosPosicaoPatioFormDto) {
    let zona = dto.zonaId
      ? await this.prisma.posicaoPatioZona.findFirst({
          where: { id: dto.zonaId, deletedAt: null },
        })
      : null;

    const zonaCodigo = (dto.zonaCodigo || dto.zonaNome || '').trim().toUpperCase().slice(0, 16);
    const zonaNome = (dto.zonaNome || dto.zonaCodigo || 'Zona').trim();

    if (!zona && zonaCodigo) {
      zona = await this.prisma.posicaoPatioZona.upsert({
        where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: zonaCodigo } },
        update: { nome: zonaNome, cor: dto.zonaCor ?? '#3B82F6', deletedAt: null, ativo: true },
        create: {
          tenantId: DEFAULT_TENANT,
          codigo: zonaCodigo,
          nome: zonaNome,
          cor: dto.zonaCor ?? '#3B82F6',
        },
      });
    }

    if (!zona) throw new ConflictException('Zona é obrigatória.');

    const baiaCodigo = dto.baiaCodigo.trim().toUpperCase();
    let baia = await this.prisma.posicaoPatioBaia.findFirst({
      where: { tenantId: DEFAULT_TENANT, zonaId: zona.id, codigo: baiaCodigo, deletedAt: null },
    });
    if (!baia) {
      baia = await this.prisma.posicaoPatioBaia.create({
        data: { tenantId: DEFAULT_TENANT, zonaId: zona.id, codigo: baiaCodigo },
      });
    }

    return { zona, baia };
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroPosicaoPatio.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Posição de pátio não encontrada.');
    return row;
  }

  private toShape(row: {
    id: string;
    zonaId: string;
    baiaId: string;
    codigo: string;
    zonaCodigo: string;
    baiaCodigo: string;
    zonaNome: string;
    zonaCor: string;
    slotNumero: number;
    stackAltura: number;
    tipoAceito: string;
    tomadaReefer: boolean;
    capacidadePeso: Prisma.Decimal | null;
    status: string;
    restricoes: string | null;
    containerAtual: string | null;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      zonaId: row.zonaId,
      baiaId: row.baiaId,
      codigo: row.codigo,
      zonaCodigo: row.zonaCodigo,
      baiaCodigo: row.baiaCodigo,
      zonaNome: row.zonaNome,
      zonaCor: row.zonaCor,
      slotNumero: row.slotNumero,
      stackAltura: row.stackAltura,
      tipoAceito: row.tipoAceito,
      tomadaReefer: row.tomadaReefer,
      capacidadePeso: row.capacidadePeso != null ? Number(row.capacidadePeso) : null,
      status: row.status,
      restricoes: row.restricoes,
      containerAtual: row.containerAtual,
      ativo: row.ativo,
    };
  }
}
