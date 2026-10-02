import * as XLSX from 'xlsx';
import { formatNavioNome, normalizeNavioNome, parseNavioNome, stripNavioAccents } from './catalogo-navios.util';

export const CATALOGO_NAVIOS_IMPORT_COLUNAS = ['nome'] as const;

export const CATALOGO_NAVIOS_IMPORT_EXEMPLO = {
  nome: 'MSC SABRINA',
} as const;

export const CATALOGO_NAVIOS_IMPORT_MODELO_FILENAME = 'catalogo-navios-modelo.xls';

export type CatalogoNaviosImportLinhaOk = {
  linha: number;
  nome: string;
  nomeNorm: string;
};

export type CatalogoNaviosImportLinhaErro = {
  linha: number;
  nome: string;
  motivo: string;
};

export type CatalogoNaviosImportParseResult = {
  linhas: CatalogoNaviosImportLinhaOk[];
  erros: CatalogoNaviosImportLinhaErro[];
  duplicadosNaPlanilha: number;
};

function normalizeHeader(value: unknown): string {
  return stripNavioAccents(String(value ?? ''))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const HEADER_ALIASES = new Set([
  'nome',
  'navio',
  'nome_do_navio',
  'nomenavio',
  'ship',
  'vessel',
]);

function cellText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function parseCatalogoNaviosRows(rows: unknown[][]): CatalogoNaviosImportParseResult {
  if (!rows.length) {
    return {
      linhas: [],
      erros: [{ linha: 1, nome: '', motivo: 'Planilha vazia.' }],
      duplicadosNaPlanilha: 0,
    };
  }

  const headers = (rows[0] ?? []).map((h) => normalizeHeader(h));
  let col = headers.findIndex((h) => HEADER_ALIASES.has(h));
  if (col < 0 && headers.length === 1 && !headers[0]) col = 0;
  if (col < 0 && rows.length > 1 && parseNavioNome(cellText(rows[1]?.[0]))) {
    col = 0;
  }
  if (col < 0) {
    return {
      linhas: [],
      erros: [{ linha: 1, nome: '', motivo: 'Falta a coluna nome (ou Nome do Navio).' }],
      duplicadosNaPlanilha: 0,
    };
  }

  const byNorm = new Map<string, CatalogoNaviosImportLinhaOk>();
  const erros: CatalogoNaviosImportLinhaErro[] = [];
  let duplicadosNaPlanilha = 0;

  for (let i = 1; i < rows.length; i++) {
    const linha = i + 1;
    const raw = cellText(rows[i]?.[col]);
    if (!raw) continue;
    const parsed = parseNavioNome(raw);
    if (!parsed) {
      erros.push({
        linha,
        nome: formatNavioNome(raw),
        motivo: 'Nome inválido (mínimo 2 caracteres).',
      });
      continue;
    }
    if (byNorm.has(parsed.nomeNorm)) duplicadosNaPlanilha += 1;
    byNorm.set(parsed.nomeNorm, { linha, ...parsed });
  }

  return { linhas: [...byNorm.values()], erros, duplicadosNaPlanilha };
}

export function parseCatalogoNaviosBuffer(buffer: Buffer): CatalogoNaviosImportParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });
  } catch {
    return {
      linhas: [],
      erros: [{ linha: 1, nome: '', motivo: 'Arquivo Excel inválido. Use o modelo .xls.' }],
      duplicadosNaPlanilha: 0,
    };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { linhas: [], erros: [{ linha: 1, nome: '', motivo: 'Arquivo sem aba.' }], duplicadosNaPlanilha: 0 };
  }
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  return parseCatalogoNaviosRows(rows);
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

export function buildCatalogoNaviosModeloXls(): Buffer {
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="navios">
  <Table>
   ${xmlRow([...CATALOGO_NAVIOS_IMPORT_COLUNAS])}
   ${xmlRow([CATALOGO_NAVIOS_IMPORT_EXEMPLO.nome])}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="instrucoes">
  <Table>
   ${xmlRow(['Coluna', 'Obrigatorio', 'Exemplo', 'Observacao'])}
   ${xmlRow(['nome', 'sim', 'MSC SABRINA', 'Somente o nome do navio. Duplicatas (mesmo nome, maiúsculas/acentos) valem a última.'])}
   ${xmlRow(['', '', '', 'Aceita também a coluna "Nome do Navio". Apague a linha de exemplo.'])}
  </Table>
 </Worksheet>
</Workbook>
`;
  return Buffer.from(xml, 'utf8');
}

export { normalizeNavioNome };
