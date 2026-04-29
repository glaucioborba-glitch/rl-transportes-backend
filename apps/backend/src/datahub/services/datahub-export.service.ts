import { Injectable } from '@nestjs/common';
import type { NomeDim, NomeFato } from '../datahub.types';
import { DW_CATALOGO_DIMENSOES, DW_CATALOGO_FATOS } from '../datahub-dw.catalog';
import { DatahubDwStore } from '../datahub-dw.store';

function paginar<T>(rows: T[], page: number, limit: number): { slice: T[]; total: number } {
  const total = rows.length;
  const start = (page - 1) * limit;
  return { slice: rows.slice(start, start + limit), total };
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

@Injectable()
export class DatahubExportService {
  constructor(private readonly dw: DatahubDwStore) {}

  exportFatos(query: {
    formato?: 'json' | 'csv';
    page?: number;
    limit?: number;
    fato?: string;
    from?: string;
    to?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 500);
    const nome = query.fato as NomeFato | undefined;
    const conjunto = nome
      ? { [nome]: this.dw.fatos[nome] ?? [] }
      : (this.dw.fatos as Record<string, Record<string, unknown>[]>);

    let todas: Record<string, unknown>[] = [];
    if (nome) {
      todas = this.filterPeriod(conjunto[nome] ?? [], query.from, query.to);
    } else {
      for (const [k, rows] of Object.entries(conjunto)) {
        for (const r of rows ?? []) todas.push({ _fato: k, ...r });
      }
    }

    const { slice, total } = paginar(todas, page, limit);
    const formato = query.formato ?? 'json';

    return {
      geradoEm: new Date().toISOString(),
      formato,
      pagina: page,
      limite: limit,
      totalLinhas: total,
      catalogoReferencia: nome ? { [nome]: DW_CATALOGO_FATOS[nome] } : DW_CATALOGO_FATOS,
      dados:
        formato === 'csv'
          ? { tipo: 'csv', conteudo: toCsv(slice as Record<string, unknown>[]) }
          : { tipo: 'json', linhas: slice },
    };
  }

  exportDimensoes(query: {
    formato?: 'json' | 'csv';
    page?: number;
    limit?: number;
    dim?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 500);
    const nome = query.dim as NomeDim | undefined;
    const conjunto = nome
      ? { [nome]: this.dw.dimensoes[nome] ?? [] }
      : (this.dw.dimensoes as Record<string, Record<string, unknown>[]>);

    let todas: Record<string, unknown>[] = [];
    if (nome) {
      todas = conjunto[nome] ?? [];
    } else {
      for (const [k, rows] of Object.entries(conjunto)) {
        for (const r of rows ?? []) todas.push({ _dim: k, ...r });
      }
    }

    const { slice, total } = paginar(todas, page, limit);
    const formato = query.formato ?? 'json';

    return {
      geradoEm: new Date().toISOString(),
      formato,
      pagina: page,
      limite: limit,
      totalLinhas: total,
      catalogoReferencia: nome ? { [nome]: DW_CATALOGO_DIMENSOES[nome] } : DW_CATALOGO_DIMENSOES,
      dados:
        formato === 'csv'
          ? { tipo: 'csv', conteudo: toCsv(slice as Record<string, unknown>[]) }
          : { tipo: 'json', linhas: slice },
    };
  }

  private filterPeriod(
    rows: Record<string, unknown>[],
    from?: string,
    to?: string,
  ): Record<string, unknown>[] {
    if (!from && !to) return rows;
    const f = from?.slice(0, 10);
    const t = to?.slice(0, 10);
    return rows.filter((r) => {
      const raw = JSON.stringify(r);
      const m = raw.match(/\d{4}-\d{2}-\d{2}/);
      if (!m) return true;
      const ds = m[0];
      if (f && ds < f) return false;
      if (t && ds > t) return false;
      return true;
    });
  }
}
