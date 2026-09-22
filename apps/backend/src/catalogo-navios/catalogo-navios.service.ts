import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildCatalogoNaviosModeloXls,
  CATALOGO_NAVIOS_IMPORT_MODELO_FILENAME,
  parseCatalogoNaviosBuffer,
  type CatalogoNaviosImportLinhaErro,
} from './catalogo-navios-import.util';
import { normalizeNavioNome, parseNavioNome } from './catalogo-navios.util';

export type CatalogoNavioDto = {
  nome: string;
  origem: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type CatalogoNaviosImportResultado = {
  criados: number;
  atualizados: number;
  erros: CatalogoNaviosImportLinhaErro[];
  duplicadosNaPlanilha: number;
};

@Injectable()
export class CatalogoNaviosService {
  private readonly logger = new Logger(CatalogoNaviosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listar(q?: string, take = 200): Promise<{ items: CatalogoNavioDto[]; total: number }> {
    const nomeNorm = q ? normalizeNavioNome(q) : '';
    const where = nomeNorm
      ? { nomeNorm: { contains: nomeNorm } }
      : {};
    const limit = Math.min(Math.max(take, 1), 500);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.catalogoNavio.findMany({
        where,
        orderBy: { nome: 'asc' },
        take: limit,
      }),
      this.prisma.catalogoNavio.count({ where }),
    ]);
    return { items: items.map((r) => this.toDto(r)), total };
  }

  async registrar(raw: unknown, origem = 'SOLICITACAO'): Promise<void> {
    const parsed = parseNavioNome(raw);
    if (!parsed) return;
    try {
      await this.prisma.catalogoNavio.upsert({
        where: { nomeNorm: parsed.nomeNorm },
        create: {
          nome: parsed.nome,
          nomeNorm: parsed.nomeNorm,
          origem,
        },
        update: {},
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return;
      }
      this.logger.warn(`Catálogo de navio não gravou: ${(err as Error).message}`);
    }
  }

  async registrarMuitos(nomes: Array<string | null | undefined>, origem = 'SOLICITACAO'): Promise<void> {
    const vistos = new Set<string>();
    for (const n of nomes) {
      const parsed = parseNavioNome(n);
      if (!parsed || vistos.has(parsed.nomeNorm)) continue;
      vistos.add(parsed.nomeNorm);
      await this.registrar(parsed.nome, origem);
    }
  }

  modeloImportacao(): { filename: string; buffer: Buffer; contentType: string } {
    return {
      filename: CATALOGO_NAVIOS_IMPORT_MODELO_FILENAME,
      buffer: buildCatalogoNaviosModeloXls(),
      contentType: 'application/vnd.ms-excel',
    };
  }

  async importarPlanilha(file?: Express.Multer.File): Promise<CatalogoNaviosImportResultado> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo .xls ou .xlsx.');
    }
    const parsed = parseCatalogoNaviosBuffer(file.buffer);
    if (!parsed.linhas.length && parsed.erros.length) {
      return {
        criados: 0,
        atualizados: 0,
        erros: parsed.erros,
        duplicadosNaPlanilha: parsed.duplicadosNaPlanilha,
      };
    }
    if (!parsed.linhas.length) {
      throw new BadRequestException('Nenhuma linha válida na planilha.');
    }

    const norms = parsed.linhas.map((l) => l.nomeNorm);
    const existing = await this.prisma.catalogoNavio.findMany({
      where: { nomeNorm: { in: norms } },
      select: { nomeNorm: true },
    });
    const known = new Set(existing.map((r) => r.nomeNorm));
    let criados = 0;
    let atualizados = 0;
    const erros = [...parsed.erros];

    for (const linha of parsed.linhas) {
      try {
        if (known.has(linha.nomeNorm)) {
          atualizados += 1;
          continue;
        }
        await this.prisma.catalogoNavio.create({
          data: {
            nome: linha.nome,
            nomeNorm: linha.nomeNorm,
            origem: 'IMPORT',
          },
        });
        criados += 1;
        known.add(linha.nomeNorm);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          atualizados += 1;
          continue;
        }
        erros.push({
          linha: linha.linha,
          nome: linha.nome,
          motivo: (err as Error).message,
        });
      }
    }

    return {
      criados,
      atualizados,
      erros,
      duplicadosNaPlanilha: parsed.duplicadosNaPlanilha,
    };
  }

  private toDto(row: { nome: string; origem: string; createdAt: Date; updatedAt: Date }): CatalogoNavioDto {
    return {
      nome: row.nome,
      origem: row.origem,
      criadoEm: row.createdAt.toISOString(),
      atualizadoEm: row.updatedAt.toISOString(),
    };
  }
}
