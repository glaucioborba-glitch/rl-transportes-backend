import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeTamanhoContainer, resolveTipoContainerCodigo } from '../cadastros/tipo-container-tamanhos.util';
import {
  parseContainerExtras,
  temContainerOcrExtras,
  type ContainerOcrExtras,
} from '../modules/ocr/utils/ocr-parsers';
import {
  buildCatalogoImportModeloXls,
  CATALOGO_IMPORT_MODELO_FILENAME,
  parseCatalogoImportBuffer,
  type CatalogoImportLinhaErro,
} from './catalogo-containers-import.util';
import {
  kgFromUnknown,
  mergeCatalogoContainer,
  normalizeCatalogoIso,
  resolveCatalogoCapacidade,
} from './catalogo-containers.util';

export type CatalogoContainerDto = {
  unidadeIso: string;
  tipoIso: string | null;
  tipoCodigo: string | null;
  tamanhoPes: string | null;
  perfil: string | null;
  capacidade: 'DC' | 'HC' | null;
  rotulo: string | null;
  mgwKg: number | null;
  taraKg: number | null;
  payloadKg: number | null;
  owner: string | null;
  confirmadoEm: string;
  atualizadoEm: string;
};

export type CatalogoImportResultado = {
  criados: number;
  atualizados: number;
  erros: CatalogoImportLinhaErro[];
  duplicadosNaPlanilha: number;
};

@Injectable()
export class CatalogoContainersService {
  private readonly logger = new Logger(CatalogoContainersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buscar(iso: string): Promise<CatalogoContainerDto | null> {
    const unidadeIso = normalizeCatalogoIso(iso);
    if (unidadeIso.length !== 11) return null;
    const row = await this.prisma.catalogoContainerIso.findUnique({ where: { unidadeIso } });
    return row ? this.toDto(row) : null;
  }

  async listar(q?: string, take = 80): Promise<{ items: CatalogoContainerDto[]; total: number }> {
    const iso = q ? normalizeCatalogoIso(q) : '';
    const where = iso
      ? { unidadeIso: { startsWith: iso } }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.catalogoContainerIso.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: Math.min(Math.max(take, 1), 200),
      }),
      this.prisma.catalogoContainerIso.count({ where }),
    ]);
    return { items: items.map((r) => this.toDto(r)), total };
  }

  async registrarDaOperacao(input: {
    unidadeIso: string;
    tipoCodigo?: string | null;
    tamanho?: string | null;
    fotos?: Array<{
      tipo: string;
      ocrExtras?: ContainerOcrExtras;
      ocrTextoBruto?: string;
    }>;
  }): Promise<void> {
    const unidadeIso = normalizeCatalogoIso(input.unidadeIso);
    if (unidadeIso.length !== 11) return;

    const foto = (input.fotos ?? []).find((f) => f.tipo === 'CONTAINER_OCR');
    const extras = temContainerOcrExtras(foto?.ocrExtras)
      ? (foto?.ocrExtras ?? {})
      : parseContainerExtras(foto?.ocrTextoBruto ?? '');

    const tipoCodigo = resolveTipoContainerCodigo(input.tipoCodigo) || null;
    const tamanhoPes = normalizeTamanhoContainer(input.tamanho) || extras.tamanhoPes || null;

    try {
      const existing = await this.prisma.catalogoContainerIso.findUnique({ where: { unidadeIso } });
      const merged = mergeCatalogoContainer(existing, {
        unidadeIso,
        tipoIso: extras.tipoIso,
        tipoCodigo,
        tamanhoPes,
        perfil: extras.perfil,
        owner: extras.owner,
        mgwKg: kgFromUnknown(extras.mgwKg),
        taraKg: kgFromUnknown(extras.taraKg),
        payloadKg: kgFromUnknown(extras.payloadKg),
      });
      const now = new Date();
      const data = {
        tipoIso: merged.tipoIso,
        tipoCodigo: merged.tipoCodigo,
        tamanhoPes: merged.tamanhoPes,
        perfil: merged.perfil,
        owner: merged.owner,
        mgwKg: merged.mgwKg,
        taraKg: merged.taraKg,
        payloadKg: merged.payloadKg,
        origem: 'GATE',
        confirmadoEm: now,
      };
      if (existing) {
        await this.prisma.catalogoContainerIso.update({
          where: { unidadeIso },
          data,
        });
        return;
      }
      await this.prisma.catalogoContainerIso.create({
        data: { unidadeIso, ...data },
      });
    } catch (err) {
      this.logger.warn(
        `Catálogo ISO ${unidadeIso} não gravou: ${(err as Error).message}`,
      );
    }
  }

  modeloImportacao(): { filename: string; buffer: Buffer; contentType: string } {
    return {
      filename: CATALOGO_IMPORT_MODELO_FILENAME,
      buffer: buildCatalogoImportModeloXls(),
      contentType: 'application/vnd.ms-excel',
    };
  }

  async importarPlanilha(file?: Express.Multer.File): Promise<CatalogoImportResultado> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo .xls ou .xlsx.');
    }
    const parsed = parseCatalogoImportBuffer(file.buffer);
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

    const isos = parsed.linhas.map((l) => l.unidadeIso);
    const existing = await this.prisma.catalogoContainerIso.findMany({
      where: { unidadeIso: { in: isos } },
    });
    const byIso = new Map(existing.map((row) => [row.unidadeIso, row]));
    const now = new Date();
    let criados = 0;
    let atualizados = 0;
    const erros = [...parsed.erros];

    for (const linha of parsed.linhas) {
      const atual = byIso.get(linha.unidadeIso);
      const merged = mergeCatalogoContainer(atual, linha);
      const data = {
        tipoIso: merged.tipoIso ?? null,
        tipoCodigo: merged.tipoCodigo ?? null,
        tamanhoPes: merged.tamanhoPes ?? null,
        perfil: merged.perfil ?? null,
        owner: merged.owner ?? null,
        mgwKg: merged.mgwKg ?? null,
        taraKg: merged.taraKg ?? null,
        payloadKg: merged.payloadKg ?? null,
        confirmadoEm: now,
      };
      try {
        if (atual) {
          await this.prisma.catalogoContainerIso.update({
            where: { unidadeIso: linha.unidadeIso },
            data,
          });
          atualizados += 1;
        } else {
          await this.prisma.catalogoContainerIso.create({
            data: {
              unidadeIso: linha.unidadeIso,
              ...data,
              origem: 'IMPORT',
            },
          });
          criados += 1;
        }
      } catch (err) {
        erros.push({
          linha: linha.linha,
          iso: linha.unidadeIso,
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

  private toDto(row: {
    unidadeIso: string;
    tipoIso: string | null;
    tipoCodigo: string | null;
    tamanhoPes: string | null;
    perfil: string | null;
    mgwKg: number | null;
    taraKg: number | null;
    payloadKg: number | null;
    owner: string | null;
    confirmadoEm: Date;
    updatedAt: Date;
  }): CatalogoContainerDto {
    const rotulo =
      row.tamanhoPes && row.perfil
        ? `${row.tamanhoPes}' ${row.perfil}`
        : row.tamanhoPes
          ? `${row.tamanhoPes}'`
          : null;
    return {
      unidadeIso: row.unidadeIso,
      tipoIso: row.tipoIso,
      tipoCodigo: row.tipoCodigo,
      tamanhoPes: row.tamanhoPes,
      perfil: row.perfil,
      capacidade: resolveCatalogoCapacidade(row),
      rotulo,
      mgwKg: row.mgwKg,
      taraKg: row.taraKg,
      payloadKg: row.payloadKg,
      owner: row.owner,
      confirmadoEm: row.confirmadoEm.toISOString(),
      atualizadoEm: row.updatedAt.toISOString(),
    };
  }
}
