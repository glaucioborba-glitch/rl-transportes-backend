import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosLocalTransporteFormDto } from './dto/cadastros-local-transporte-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosLocaisTransporteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search?: string) {
    const q = search?.trim();
    const rows = await this.prisma.cadastroLocalTransporte.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { codigo: { contains: q, mode: 'insensitive' } },
                { nome: { contains: q, mode: 'insensitive' } },
                { cidade: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
    });
    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  /** Catálogo read-only para o portal (só locais ativos). */
  async listAtivosForPortal() {
    const rows = await this.prisma.cadastroLocalTransporte.findMany({
      where: { deletedAt: null, ativo: true },
      orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
    });
    return {
      items: rows.map((r) => {
        const s = this.toShape(r);
        return {
          id: s.id,
          codigo: s.codigo,
          nome: s.nome,
          tipo: s.tipo,
          cidade: s.cidade,
          uf: s.uf,
          padrao: s.padrao,
        };
      }),
      total: rows.length,
    };
  }

  labelDestino(local: { nome: string; codigo: string }) {
    return `${local.nome} (${local.codigo})`;
  }

  async resolveDestinoCadastrado(raw: string) {
    const q = raw.trim();
    if (!q) return null;
    const { items } = await this.listAtivosForPortal();
    return (
      items.find((l) => {
        const label = this.labelDestino(l);
        return (
          l.id === q ||
          l.codigo.toUpperCase() === q.toUpperCase() ||
          l.nome === q ||
          label === q
        );
      }) ?? null
    );
  }

  async findOne(id: string) {
    return this.toShape(await this.getRowOrThrow(id));
  }

  async create(dto: CadastrosLocalTransporteFormDto) {
    const codigo = dto.codigo.trim().toUpperCase();
    await this.assertCodigoUnico(codigo);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cadastroLocalTransporte.create({
        data: this.toData(dto, codigo),
      });
      if (dto.padrao) await this.unsetOutrosPadroes(tx, created.id);
      return created;
    });
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosLocalTransporteFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    await this.assertCodigoUnico(codigo, id);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cadastroLocalTransporte.update({
        where: { id },
        data: {
          ...this.toData(dto, codigo),
          deletedAt: dto.ativo === false ? new Date() : null,
        },
      });
      if (dto.padrao) await this.unsetOutrosPadroes(tx, id);
      return updated;
    });
    return this.toShape(row);
  }

  private async unsetOutrosPadroes(tx: Prisma.TransactionClient, keepId: string) {
    await tx.cadastroLocalTransporte.updateMany({
      where: { tenantId: DEFAULT_TENANT, padrao: true, NOT: { id: keepId } },
      data: { padrao: false },
    });
  }

  private toData(dto: CadastrosLocalTransporteFormDto, codigo: string) {
    const uf = dto.uf?.trim().toUpperCase() || null;
    const lat = dto.lat == null ? null : Number(dto.lat);
    const lng = dto.lng == null ? null : Number(dto.lng);
    const temLat = lat != null && Number.isFinite(lat);
    const temLng = lng != null && Number.isFinite(lng);
    if (temLat !== temLng) {
      throw new BadRequestException('Informe latitude e longitude juntas, ou deixe as duas em branco.');
    }
    return {
      tenantId: DEFAULT_TENANT,
      codigo,
      nome: dto.nome.trim(),
      tipo: (dto.tipo?.trim().toUpperCase() || 'OUTRO') as string,
      cidade: dto.cidade?.trim() || null,
      uf: uf && uf.length === 2 ? uf : null,
      lat: temLat ? lat : null,
      lng: temLng ? lng : null,
      ativo: dto.ativo ?? true,
      padrao: dto.padrao ?? false,
    };
  }

  private async assertCodigoUnico(codigo: string, excludeId?: string) {
    const dup = await this.prisma.cadastroLocalTransporte.findFirst({
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
    const row = await this.prisma.cadastroLocalTransporte.findUnique({ where: { id } });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Origem/destino não encontrado.');
    }
    return row;
  }

  private toShape(row: {
    id: string;
    codigo: string;
    nome: string;
    tipo: string;
    cidade: string | null;
    uf: string | null;
    lat: number | null;
    lng: number | null;
    ativo: boolean;
    padrao: boolean;
  }) {
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      tipo: row.tipo,
      cidade: row.cidade,
      uf: row.uf,
      lat: row.lat,
      lng: row.lng,
      ativo: row.ativo,
      padrao: row.padrao,
    };
  }
}
