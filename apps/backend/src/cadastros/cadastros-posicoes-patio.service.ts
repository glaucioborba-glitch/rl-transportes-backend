import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  codigoPatioZonaPosicao,
  normalizeZonaPatio,
  parsePatioZonaPosicao,
  PATIO_POSICOES_POR_ZONA,
  PATIO_ZONAS,
} from '../patio-v2/patio-fila.util';
import {
  CadastrosPosicaoPatioDisponiveisQueryDto,
  CadastrosPosicaoPatioFormDto,
  CadastrosZonaPatioFormDto,
} from './dto/cadastros-posicao-patio-form.dto';

const DEFAULT_TENANT = 'default';

const ZONAS_PADRAO: Array<{ codigo: (typeof PATIO_ZONAS)[number]; nome: string; cor: string }> = [
  { codigo: 'A', nome: 'Zona A', cor: '#3B82F6' },
  { codigo: 'B', nome: 'Zona B', cor: '#10B981' },
  { codigo: 'C', nome: 'Zona C', cor: '#F59E0B' },
];

@Injectable()
export class CadastrosPosicoesPatioService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.cadastroPosicaoPatio.findMany({
      where: { deletedAt: null },
      orderBy: [{ zonaCodigo: 'asc' }, { slotNumero: 'asc' }, { codigo: 'asc' }],
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

  async createZona(dto: CadastrosZonaPatioFormDto) {
    const codigo = this.validarCodigoZona(dto.codigo);
    const already = await this.prisma.posicaoPatioZona.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null, ativo: true },
    });
    if (already) {
      return this.updateZona(already.id, dto);
    }

    const nome = (dto.nome?.trim() || `Zona ${codigo}`).slice(0, 120);
    const cor = dto.cor?.trim() || '#3B82F6';
    const zona = await this.prisma.posicaoPatioZona.upsert({
      where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo } },
      update: { nome, cor, deletedAt: null, ativo: true },
      create: { tenantId: DEFAULT_TENANT, codigo, nome, cor },
    });

    const quantidade = this.resolveQuantidadePosicoes(dto);
    const criadas = quantidade > 0 ? await this.completarGradeZona(zona, quantidade) : 0;
    return {
      zona: { id: zona.id, codigo: zona.codigo, nome: zona.nome, cor: zona.cor },
      criadas,
    };
  }

  async updateZona(id: string, dto: CadastrosZonaPatioFormDto) {
    const zona = await this.getZonaOrThrow(id);
    const codigo = this.validarCodigoZona(dto.codigo);
    const nome = (dto.nome?.trim() || `Zona ${codigo}`).slice(0, 120);
    const cor = dto.cor?.trim() || zona.cor;

    if (codigo !== zona.codigo) {
      const clash = await this.prisma.posicaoPatioZona.findFirst({
        where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null, NOT: { id: zona.id } },
      });
      if (clash) throw new ConflictException(`Zona ${codigo} já cadastrada.`);
      await this.renomearCodigosDaZona(zona, codigo);
    }

    const updated = await this.prisma.posicaoPatioZona.update({
      where: { id: zona.id },
      data: { codigo, nome, cor, deletedAt: null, ativo: true },
    });
    await this.prisma.cadastroPosicaoPatio.updateMany({
      where: { zonaId: zona.id, deletedAt: null },
      data: { zonaCodigo: codigo, zonaNome: nome, zonaCor: cor },
    });
    const quantidade = this.resolveQuantidadePosicoes(dto);
    const criadas = quantidade > 0 ? await this.completarGradeZona(updated, quantidade) : 0;
    return {
      zona: { id: updated.id, codigo: updated.codigo, nome: updated.nome, cor: updated.cor },
      criadas,
    };
  }

  async removeZona(id: string) {
    const zona = await this.getZonaOrThrow(id);
    const agora = new Date();
    await this.prisma.cadastroPosicaoPatio.updateMany({
      where: { zonaId: zona.id, deletedAt: null },
      data: { ativo: false, deletedAt: agora },
    });
    await this.prisma.posicaoPatioBaia.updateMany({
      where: { zonaId: zona.id, deletedAt: null },
      data: { ativo: false, deletedAt: agora },
    });
    await this.prisma.posicaoPatioZona.update({
      where: { id: zona.id },
      data: { ativo: false, deletedAt: agora },
    });
  }

  async completarGradeZona(
    zona: { id: string; codigo: string; nome: string; cor: string },
    quantidade = PATIO_POSICOES_POR_ZONA,
  ) {
    const teto = Math.min(PATIO_POSICOES_POR_ZONA, Math.max(0, Math.floor(quantidade)));
    const baia = await this.ensureBaia(zona);

    let criadas = 0;
    for (let posicao = 1; posicao <= teto; posicao++) {
      const codigo = codigoPatioZonaPosicao(zona.codigo, posicao);
      const existing = await this.prisma.cadastroPosicaoPatio.findFirst({
        where: { tenantId: DEFAULT_TENANT, codigo },
      });
      if (existing) {
        if (
          existing.deletedAt ||
          existing.zonaId !== zona.id ||
          existing.baiaId !== baia.id ||
          existing.slotNumero !== posicao
        ) {
          await this.prisma.cadastroPosicaoPatio.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              ativo: true,
              zonaId: zona.id,
              baiaId: baia.id,
              zonaCodigo: zona.codigo,
              baiaCodigo: baia.codigo,
              zonaNome: zona.nome,
              zonaCor: zona.cor,
              slotNumero: posicao,
              stackAltura: 1,
            },
          });
          criadas += 1;
        }
        continue;
      }
      try {
        await this.prisma.cadastroPosicaoPatio.create({
          data: {
            tenantId: DEFAULT_TENANT,
            zonaId: zona.id,
            baiaId: baia.id,
            codigo,
            zonaCodigo: zona.codigo,
            baiaCodigo: baia.codigo,
            zonaNome: zona.nome,
            zonaCor: zona.cor,
            slotNumero: posicao,
            stackAltura: 1,
            tipoAceito: 'MISTO',
            tomadaReefer: false,
            status: 'LIVRE',
            ativo: true,
          },
        });
        criadas += 1;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
          throw err;
        }
      }
    }
    return criadas;
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
      orderBy: [{ zonaCodigo: 'asc' }, { slotNumero: 'asc' }],
    });
    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return this.toShape(row);
  }

  async create(dto: CadastrosPosicaoPatioFormDto) {
    const posicao = this.resolvePosicao(dto);
    const { zona, baia } = await this.resolveZonaBaia(dto);
    const codigo = codigoPatioZonaPosicao(zona.codigo, posicao);
    const existing = await this.prisma.cadastroPosicaoPatio.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo },
    });
    if (existing) {
      return this.writePosicao(existing.id, dto, zona, baia, codigo, posicao);
    }
    try {
      const row = await this.prisma.cadastroPosicaoPatio.create({
        data: this.buildData(dto, zona, baia, codigo, posicao),
      });
      return this.toShape(row);
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
        throw err;
      }
      const again = await this.prisma.cadastroPosicaoPatio.findFirst({
        where: { tenantId: DEFAULT_TENANT, codigo },
      });
      if (again) return this.writePosicao(again.id, dto, zona, baia, codigo, posicao);
      throw err;
    }
  }

  async update(id: string, dto: CadastrosPosicaoPatioFormDto) {
    await this.getRowOrThrow(id);
    const posicao = this.resolvePosicao(dto);
    const { zona, baia } = await this.resolveZonaBaia(dto);
    const codigo = codigoPatioZonaPosicao(zona.codigo, posicao);
    const dup = await this.prisma.cadastroPosicaoPatio.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null, NOT: { id } },
    });
    if (dup) throw new ConflictException(`Posição já cadastrada: ${codigo}.`);
    return this.writePosicao(id, dto, zona, baia, codigo, posicao);
  }

  async remove(id: string) {
    await this.getRowOrThrow(id);
    await this.prisma.cadastroPosicaoPatio.update({
      where: { id },
      data: { ativo: false, deletedAt: new Date() },
    });
  }

  async ensureGradePadrao() {
    const criadas: string[] = [];
    const jaExistiam: string[] = [];

    for (const z of ZONAS_PADRAO) {
      const zona = await this.prisma.posicaoPatioZona.upsert({
        where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: z.codigo } },
        update: { nome: z.nome, cor: z.cor, deletedAt: null, ativo: true },
        create: { tenantId: DEFAULT_TENANT, codigo: z.codigo, nome: z.nome, cor: z.cor },
      });
      let baia = await this.prisma.posicaoPatioBaia.findFirst({
        where: { tenantId: DEFAULT_TENANT, zonaId: zona.id, codigo: z.codigo, deletedAt: null },
      });
      if (!baia) {
        baia = await this.prisma.posicaoPatioBaia.create({
          data: { tenantId: DEFAULT_TENANT, zonaId: zona.id, codigo: z.codigo },
        });
      }

      for (let posicao = 1; posicao <= PATIO_POSICOES_POR_ZONA; posicao++) {
        const codigo = codigoPatioZonaPosicao(z.codigo, posicao);
        const existing = await this.prisma.cadastroPosicaoPatio.findFirst({
          where: { tenantId: DEFAULT_TENANT, codigo },
        });
        if (existing) {
          if (existing.deletedAt) {
            await this.prisma.cadastroPosicaoPatio.update({
              where: { id: existing.id },
              data: {
                deletedAt: null,
                ativo: true,
                zonaId: zona.id,
                baiaId: baia.id,
                zonaCodigo: zona.codigo,
                baiaCodigo: baia.codigo,
                zonaNome: zona.nome,
                zonaCor: zona.cor,
                slotNumero: posicao,
                stackAltura: 1,
              },
            });
            criadas.push(codigo);
          } else {
            jaExistiam.push(codigo);
          }
          continue;
        }
        await this.prisma.cadastroPosicaoPatio.create({
          data: {
            tenantId: DEFAULT_TENANT,
            zonaId: zona.id,
            baiaId: baia.id,
            codigo,
            zonaCodigo: zona.codigo,
            baiaCodigo: baia.codigo,
            zonaNome: zona.nome,
            zonaCor: zona.cor,
            slotNumero: posicao,
            stackAltura: 1,
            tipoAceito: 'MISTO',
            tomadaReefer: false,
            status: 'LIVRE',
            ativo: true,
          },
        });
        criadas.push(codigo);
      }
    }

    const legado = await this.prisma.cadastroPosicaoPatio.findMany({
      where: { tenantId: DEFAULT_TENANT, deletedAt: null },
      select: { id: true, codigo: true },
    });
    const arquivados = legado.filter((r) => !parsePatioZonaPosicao(r.codigo));
    if (arquivados.length) {
      await this.prisma.cadastroPosicaoPatio.updateMany({
        where: { id: { in: arquivados.map((r) => r.id) } },
        data: { ativo: false, deletedAt: new Date() },
      });
    }

    const list = await this.list();
    return {
      ...list,
      criadas: criadas.length,
      jaExistiam: jaExistiam.length,
      arquivadas: arquivados.length,
    };
  }

  private resolveQuantidadePosicoes(dto: CadastrosZonaPatioFormDto) {
    if (dto.quantidadePosicoes != null) return dto.quantidadePosicoes;
    if (dto.gerarPosicoes === false) return 0;
    return PATIO_POSICOES_POR_ZONA;
  }

  private validarCodigoZona(raw?: string) {
    const codigo = normalizeZonaPatio(raw ?? '');
    if (!/^[A-Z][A-Z0-9]{0,15}$/.test(codigo)) {
      throw new BadRequestException('Informe o código da zona (ex.: A1, A2, B7).');
    }
    return codigo;
  }

  private async getZonaOrThrow(id: string) {
    const zona = await this.prisma.posicaoPatioZona.findFirst({
      where: { id, deletedAt: null },
    });
    if (!zona) throw new NotFoundException('Zona de pátio não encontrada.');
    return zona;
  }

  private async renomearCodigosDaZona(
    zona: { id: string; codigo: string },
    novoCodigo: string,
  ) {
    const posicoes = await this.prisma.cadastroPosicaoPatio.findMany({
      where: { zonaId: zona.id },
    });
    for (const p of posicoes) {
      const zp = parsePatioZonaPosicao(p.codigo);
      const slot = zp?.posicao ?? p.slotNumero;
      const novo = codigoPatioZonaPosicao(novoCodigo, slot);
      const dup = await this.prisma.cadastroPosicaoPatio.findFirst({
        where: { tenantId: DEFAULT_TENANT, codigo: novo, deletedAt: null, NOT: { id: p.id } },
      });
      if (dup) throw new ConflictException(`Já existe a posição ${novo}.`);
      const antigo = p.codigo;
      await this.prisma.cadastroPosicaoPatio.update({
        where: { id: p.id },
        data: {
          codigo: novo,
          zonaCodigo: novoCodigo,
          baiaCodigo: novoCodigo,
        },
      });
      const patioPos = await this.prisma.patioPosicao.findUnique({ where: { codigoBaia: antigo } });
      if (patioPos) {
        const taken = await this.prisma.patioPosicao.findUnique({ where: { codigoBaia: novo } });
        if (!taken) {
          await this.prisma.patioPosicao.update({
            where: { id: patioPos.id },
            data: { codigoBaia: novo },
          });
        }
      }
    }
    await this.prisma.posicaoPatioBaia.updateMany({
      where: { zonaId: zona.id, codigo: zona.codigo, deletedAt: null },
      data: { codigo: novoCodigo },
    });
  }

  private resolvePosicao(dto: CadastrosPosicaoPatioFormDto) {
    const n = dto.posicao ?? dto.slotNumero;
    if (!n || n < 1 || n > PATIO_POSICOES_POR_ZONA) {
      throw new BadRequestException(`Posição deve ser de 1 a ${PATIO_POSICOES_POR_ZONA}.`);
    }
    return n;
  }

  private buildData(
    dto: CadastrosPosicaoPatioFormDto,
    zona: { id: string; codigo: string; nome: string; cor: string },
    baia: { id: string; codigo: string },
    codigo: string,
    posicao: number,
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
      slotNumero: posicao,
      stackAltura: 1,
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

    const zonaCodigo = (dto.zonaCodigo || zona?.codigo || '').trim().toUpperCase().slice(0, 16);
    const zonaNome = (dto.zonaNome || zona?.nome || `Zona ${zonaCodigo}` || 'Zona').trim();

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

    const baia = await this.ensureBaia({ id: zona.id, codigo: dto.baiaCodigo?.trim() || zona.codigo });
    return { zona, baia };
  }

  private async ensureBaia(zona: { id: string; codigo: string }) {
    const codigo = zona.codigo.trim().toUpperCase().slice(0, 32);
    const existing = await this.prisma.posicaoPatioBaia.findFirst({
      where: { tenantId: DEFAULT_TENANT, zonaId: zona.id, codigo },
    });
    if (existing) {
      if (existing.deletedAt || existing.ativo === false) {
        return this.prisma.posicaoPatioBaia.update({
          where: { id: existing.id },
          data: { deletedAt: null, ativo: true },
        });
      }
      return existing;
    }
    try {
      return await this.prisma.posicaoPatioBaia.create({
        data: { tenantId: DEFAULT_TENANT, zonaId: zona.id, codigo },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
        throw err;
      }
      const again = await this.prisma.posicaoPatioBaia.findFirst({
        where: { tenantId: DEFAULT_TENANT, zonaId: zona.id, codigo },
      });
      if (again) {
        return this.prisma.posicaoPatioBaia.update({
          where: { id: again.id },
          data: { deletedAt: null, ativo: true },
        });
      }
      throw err;
    }
  }

  private async writePosicao(
    id: string,
    dto: CadastrosPosicaoPatioFormDto,
    zona: { id: string; codigo: string; nome: string; cor: string },
    baia: { id: string; codigo: string },
    codigo: string,
    posicao: number,
  ) {
    const row = await this.prisma.cadastroPosicaoPatio.update({
      where: { id },
      data: {
        ...this.buildData(dto, zona, baia, codigo, posicao),
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    return this.toShape(row);
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
    const zp = parsePatioZonaPosicao(row.codigo);
    const posicao = zp?.posicao ?? row.slotNumero;
    return {
      id: row.id,
      zonaId: row.zonaId,
      baiaId: row.baiaId,
      codigo: zp ? codigoPatioZonaPosicao(zp.zona, zp.posicao) : row.codigo,
      zonaCodigo: zp?.zona ?? row.zonaCodigo,
      baiaCodigo: row.baiaCodigo,
      zonaNome: row.zonaNome,
      zonaCor: row.zonaCor,
      posicao,
      slotNumero: posicao,
      stackAltura: 1,
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
