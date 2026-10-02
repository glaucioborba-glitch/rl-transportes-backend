import * as XLSX from 'xlsx';
import { formatTipoContainerCodigo, normalizeTamanhoContainer, resolveTipoContainerCodigo } from '../cadastros/tipo-container-tamanhos.util';
import {
  kgFromUnknown,
  normalizeCapacidadeDcHc,
  normalizeCatalogoIso,
  type CatalogoContainerMergeInput,
} from './catalogo-containers.util';

export const CATALOGO_IMPORT_COLUNAS = [
  'unidade_iso',
  'tipo',
  'tamanho',
  'capacidade',
  'tara_kg',
  'mgw_kg',
  'payload_kg',
] as const;

export const CATALOGO_IMPORT_EXEMPLO = {
  unidade_iso: 'SEGU6254167',
  tipo: 'REEFER',
  tamanho: '40',
  capacidade: 'HC',
  tara_kg: '4800',
  mgw_kg: '34000',
  payload_kg: '29200',
} as const;

export const CATALOGO_IMPORT_MODELO_FILENAME = 'catalogo-containers-modelo.xls';

export type CatalogoImportCampo =
  | 'unidadeIso'
  | 'tipoCodigo'
  | 'tamanhoPes'
  | 'perfil'
  | 'taraKg'
  | 'mgwKg'
  | 'payloadKg'
  | 'tipoIso';

export type CatalogoImportLinhaOk = CatalogoContainerMergeInput & {
  unidadeIso: string;
  linha: number;
};

export type CatalogoImportLinhaErro = {
  linha: number;
  iso: string;
  motivo: string;
};

export type CatalogoImportParseResult = {
  linhas: CatalogoImportLinhaOk[];
  erros: CatalogoImportLinhaErro[];
  duplicadosNaPlanilha: number;
};

const HEADER_ALIASES: Record<string, CatalogoImportCampo> = {
  unidade_iso: 'unidadeIso',
  unidadeiso: 'unidadeIso',
  iso: 'unidadeIso',
  container: 'unidadeIso',
  caixa: 'unidadeIso',
  numero: 'unidadeIso',
  tipo: 'tipoCodigo',
  tipo_codigo: 'tipoCodigo',
  tipocodigo: 'tipoCodigo',
  cadastro: 'tipoCodigo',
  tamanho: 'tamanhoPes',
  tamanho_pes: 'tamanhoPes',
  tamanhopes: 'tamanhoPes',
  pes: 'tamanhoPes',
  capacidade: 'perfil',
  cap: 'perfil',
  cubagem: 'perfil',
  hc_dc: 'perfil',
  tara: 'taraKg',
  tara_kg: 'taraKg',
  tarakg: 'taraKg',
  mgw: 'mgwKg',
  mgw_kg: 'mgwKg',
  mgwkg: 'mgwKg',
  max_gross: 'mgwKg',
  payload: 'payloadKg',
  payload_kg: 'payloadKg',
  payloadkg: 'payloadKg',
  tipo_iso: 'tipoIso',
  tipoiso: 'tipoIso',
  tipo_porta: 'tipoIso',
  tipoporta: 'tipoIso',
};

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizeCatalogoImportHeader(value: unknown): string {
  return stripAccents(String(value ?? ''))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value) === value ? Math.trunc(value) : value);
  }
  return String(value).trim();
}

/** DRYDC/DRYHC no tipo da planilha → tipo DRY + capacidade. */
export function splitTipoECapacidadeCatalogo(tipoRaw: unknown): {
  tipo: string;
  cap: 'DC' | 'HC' | null;
} {
  const raw = formatTipoContainerCodigo(tipoRaw);
  if (raw === 'DRYDC') return { tipo: 'DRY', cap: 'DC' };
  if (raw === 'DRYHC') return { tipo: 'DRY', cap: 'HC' };
  if (raw === 'DC' || raw === 'HC') return { tipo: '', cap: raw };
  return { tipo: resolveTipoContainerCodigo(raw), cap: null };
}

export function mapCatalogoImportHeaders(headers: unknown[]): Partial<Record<CatalogoImportCampo, number>> {
  const map: Partial<Record<CatalogoImportCampo, number>> = {};
  headers.forEach((header, index) => {
    const campo = HEADER_ALIASES[normalizeCatalogoImportHeader(header)];
    if (campo && map[campo] == null) map[campo] = index;
  });
  return map;
}

export function parseCatalogoImportRows(rows: unknown[][]): CatalogoImportParseResult {
  if (!rows.length) {
    return { linhas: [], erros: [{ linha: 1, iso: '', motivo: 'Planilha vazia.' }], duplicadosNaPlanilha: 0 };
  }
  const col = mapCatalogoImportHeaders(rows[0] ?? []);
  if (col.unidadeIso == null) {
    return {
      linhas: [],
      erros: [{ linha: 1, iso: '', motivo: 'Falta a coluna unidade_iso (ou ISO).' }],
      duplicadosNaPlanilha: 0,
    };
  }

  const byIso = new Map<string, CatalogoImportLinhaOk>();
  const erros: CatalogoImportLinhaErro[] = [];
  let duplicadosNaPlanilha = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const linha = i + 1;
    const isoRaw = cellText(row[col.unidadeIso]);
    const empty =
      !isoRaw &&
      !cellText(col.tipoCodigo != null ? row[col.tipoCodigo] : '') &&
      !cellText(col.tamanhoPes != null ? row[col.tamanhoPes] : '') &&
      !cellText(col.perfil != null ? row[col.perfil] : '') &&
      !cellText(col.taraKg != null ? row[col.taraKg] : '') &&
      !cellText(col.mgwKg != null ? row[col.mgwKg] : '') &&
      !cellText(col.payloadKg != null ? row[col.payloadKg] : '');
    if (empty) continue;

    const unidadeIso = normalizeCatalogoIso(isoRaw);
    if (unidadeIso.length !== 11) {
      erros.push({
        linha,
        iso: isoRaw || unidadeIso,
        motivo: 'ISO deve ter 11 caracteres (4 letras + 7 dígitos).',
      });
      continue;
    }

    const tamanhoRaw = cellText(col.tamanhoPes != null ? row[col.tamanhoPes] : '');
    const capCell = col.perfil != null ? cellText(row[col.perfil]) : '';
    const split = splitTipoECapacidadeCatalogo(cellText(col.tipoCodigo != null ? row[col.tipoCodigo] : ''));
    const capacidade =
      normalizeCapacidadeDcHc(capCell) ?? split.cap ?? normalizeCapacidadeDcHc(tamanhoRaw);
    if (capCell && !normalizeCapacidadeDcHc(capCell)) {
      erros.push({
        linha,
        iso: unidadeIso,
        motivo: 'Capacidade ignorada — use DC ou HC (opcional).',
      });
    }

    const parsed: CatalogoImportLinhaOk = {
      linha,
      unidadeIso,
      tipoCodigo: split.tipo || null,
      tamanhoPes: normalizeTamanhoContainer(tamanhoRaw) || null,
      perfil: capacidade,
      taraKg: kgFromUnknown(col.taraKg != null ? row[col.taraKg] : null),
      mgwKg: kgFromUnknown(col.mgwKg != null ? row[col.mgwKg] : null),
      payloadKg: kgFromUnknown(col.payloadKg != null ? row[col.payloadKg] : null),
      tipoIso: cellText(col.tipoIso != null ? row[col.tipoIso] : '').toUpperCase() || null,
    };
    if (byIso.has(unidadeIso)) duplicadosNaPlanilha += 1;
    byIso.set(unidadeIso, parsed);
  }

  return { linhas: [...byIso.values()], erros, duplicadosNaPlanilha };
}

export function parseCatalogoImportBuffer(buffer: Buffer): CatalogoImportParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });
  } catch {
    return {
      linhas: [],
      erros: [{ linha: 1, iso: '', motivo: 'Arquivo Excel inválido. Use o modelo .xls.' }],
      duplicadosNaPlanilha: 0,
    };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { linhas: [], erros: [{ linha: 1, iso: '', motivo: 'Arquivo sem aba.' }], duplicadosNaPlanilha: 0 };
  }
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  return parseCatalogoImportRows(rows);
}

function xmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xmlRow(values: string[]): string {
  const cells = values
    .map((v) => `<Cell><Data ss:Type="String">${xmlText(v)}</Data></Cell>`)
    .join('');
  return `<Row>${cells}</Row>`;
}

/** Excel 2003 XML (.xls) — abre no Excel sem biblioteca paga. */
export function buildCatalogoImportModeloXls(): Buffer {
  const headers = [...CATALOGO_IMPORT_COLUNAS];
  const exemplo = headers.map((h) => CATALOGO_IMPORT_EXEMPLO[h]);
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="catalogo">
  <Table>
   ${xmlRow(headers)}
   ${xmlRow(exemplo)}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="instrucoes">
  <Table>
   ${xmlRow(['Coluna', 'Obrigatorio', 'Exemplo', 'Observacao'])}
   ${xmlRow(['unidade_iso', 'sim', 'SEGU6254167', '11 caracteres, com ou sem hifen.'])}
   ${xmlRow(['tipo', 'nao', 'DRY', 'Codigo do cadastro (ex.: DRY, REEFER). Nao misturar DC/HC no tipo.'])}
   ${xmlRow(['tamanho', 'nao', '40', '20, 40 ou 45.'])}
   ${xmlRow(['capacidade', 'nao', 'DC', 'DC ou HC. Vazio ok — o Gate confirma na foto da placa.'])}
   ${xmlRow(['tara_kg', 'nao', '4800', 'Peso da placa, em kg.'])}
   ${xmlRow(['mgw_kg', 'nao', '34000', 'Peso maximo (MGW), em kg.'])}
   ${xmlRow(['payload_kg', 'nao', '29200', 'Carga util, em kg.'])}
   ${xmlRow(['', '', '', 'Apague a linha de exemplo. Nao incluir cliente, booking ou lacre.'])}
  </Table>
 </Worksheet>
</Workbook>
`;
  return Buffer.from(xml, 'utf8');
}
