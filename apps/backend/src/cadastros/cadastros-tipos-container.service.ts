import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosTipoContainerFormDto } from './dto/cadastros-tipo-container-form.dto';
import { CadastrosTipoContainerQueryDto } from './dto/cadastros-tipo-container-query.dto';
import {
  formatTipoTamanhoContainerLabel,
  normalizeTamanhosContainer,
  resolveTipoContainerCodigo,
} from './tipo-container-tamanhos.util';

@Injectable()
export class CadastrosTiposContainerService {
  private catalogCodigosCache: { at: number; codigos: string[] } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Códigos ativos do MDM (cache curto — cadastro é a matriz). */
  async listActiveCodigos(): Promise<string[]> {
    const now = Date.now();
    if (this.catalogCodigosCache && now - this.catalogCodigosCache.at < 60_000) {
      return this.catalogCodigosCache.codigos;
    }
    const rows = await this.prisma.cadastroTipoContainer.findMany({
      where: { deletedAt: null, ativo: true },
      select: { codigo: true },
      orderBy: { codigo: 'asc' },
    });
    const codigos = rows.map((r) => r.codigo.toUpperCase());
    this.catalogCodigosCache = { at: now, codigos };
    return codigos;
  }

  invalidateCatalogCache() {
    this.catalogCodigosCache = null;
  }

  async formatTipoTamanhoLabel(tipo?: unknown, tamanho?: unknown): Promise<string | null> {
    const codigos = await this.listActiveCodigos();
    return formatTipoTamanhoContainerLabel(tipo, tamanho, codigos);
  }

  async resolveCodigo(tipo: unknown): Promise<string> {
    const codigos = await this.listActiveCodigos();
    return resolveTipoContainerCodigo(tipo, codigos);
  }

  async list(query: CadastrosTipoContainerQueryDto, _actor: AuthUser) {
    const where: Prisma.CadastroTipoContainerWhereInput = { deletedAt: null };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.cadastroTipoContainer.findMany({
      where,
      orderBy: { codigo: 'asc' },
    });

    return {
      items: rows.map((r) => this.toShape(r)),
      total: rows.length,
    };
  }

  /** Catálogo read-only para o portal do cliente (só tipos ativos). */
  async listAtivosForPortal() {
    const rows = await this.prisma.cadastroTipoContainer.findMany({
      where: { deletedAt: null, ativo: true },
      orderBy: { codigo: 'asc' },
    });
    return {
      items: rows.map((r) => {
        const shape = this.toShape(r);
        return {
          codigo: shape.codigo,
          nome: shape.nome,
          tamanhos: shape.tamanhos,
          tomadaReefer: shape.tomadaReefer,
        };
      }),
      total: rows.length,
    };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return this.toShape(row);
  }

  async create(dto: CadastrosTipoContainerFormDto) {
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroTipoContainer.findFirst({
      where: { codigo, deletedAt: null },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroTipoContainer.create({
      data: {
        codigo,
        nome: dto.nome.trim(),
        tamanhos: normalizeTamanhosContainer(dto.tamanhos),
        tomadaReefer: dto.tomadaReefer ?? false,
        ativo: dto.ativo ?? true,
      },
    });
    this.invalidateCatalogCache();
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosTipoContainerFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroTipoContainer.findFirst({
      where: { codigo, deletedAt: null, NOT: { id } },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const row = await this.prisma.cadastroTipoContainer.update({
      where: { id },
      data: {
        codigo,
        nome: dto.nome.trim(),
        tamanhos: normalizeTamanhosContainer(dto.tamanhos),
        tomadaReefer: dto.tomadaReefer ?? false,
        ativo: dto.ativo ?? true,
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    this.invalidateCatalogCache();
    return this.toShape(row);
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroTipoContainer.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Tipo de contêiner não encontrado.');
    return row;
  }

  private toShape(row: {
    id: string;
    codigo: string;
    nome: string;
    tamanhos: unknown;
    tomadaReefer: boolean;
    ativo: boolean;
  }) {
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      tamanhos: normalizeTamanhosContainer(row.tamanhos),
      tomadaReefer: row.tomadaReefer,
      ativo: row.ativo,
    };
  }
}
