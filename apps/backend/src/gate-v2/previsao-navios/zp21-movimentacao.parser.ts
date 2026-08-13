export type Zp21NavioPrevisto = {
  navio: string;
  loa: string;
  calado: string;
  rota: string;
  previsaoChegada: string;
  rebocadores: string;
};

export type Zp21NavioAtracado = {
  berco: string;
  bordo: string;
  navio: string;
  rota: string;
  dataHora: string;
};

export type Zp21NavioFundeado = {
  navio: string;
  loa: string;
  posicao: string;
  calado: string;
  rota: string;
  dataHora: string;
};

export type Zp21ManobraPrevista = {
  data: string;
  horario: string;
  manobra: string;
  berco: string;
  bordo: string;
  navio: string;
  rota: string;
  loa: string;
  boca: string;
  calado: string;
  situacao: string;
};

export type Zp21MovimentacaoSnapshot = {
  previstos: Zp21NavioPrevisto[];
  atracados: Zp21NavioAtracado[];
  fundeados: Zp21NavioFundeado[];
  manobrasPrevistas: Zp21ManobraPrevista[];
};

function decodeEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''));
}

function extractTableAfterHeading(html: string, heading: string): string | null {
  const headingIdx = html.indexOf(heading);
  if (headingIdx < 0) return null;
  const fromHeading = html.slice(headingIdx);
  const tableMatch = fromHeading.match(/<table[\s\S]*?<\/table>/i);
  return tableMatch?.[0] ?? null;
}

function parseRows(tableHtml: string): string[][] {
  const bodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
  const scope = bodyMatch?.[0] ?? tableHtml;
  const rows: string[][] = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(scope)) !== null) {
    const cells: string[] = [];
    const tdRe = /<t[dh][\s\S]*?<\/t[dh]>/gi;
    let td: RegExpExecArray | null;
    while ((td = tdRe.exec(tr[0])) !== null) {
      cells.push(stripTags(td[0]));
    }
    if (cells.length && !cells.every((c) => !c)) {
      // skip header-only rows that landed outside thead
      const isHeader =
        cells[0]?.toLowerCase() === 'navio' ||
        cells[0]?.toLowerCase() === 'data' ||
        cells[0]?.toLowerCase() === 'berço' ||
        cells[0]?.toLowerCase() === 'berco';
      if (!isHeader) rows.push(cells);
    }
  }
  return rows;
}

function cell(row: string[], idx: number): string {
  return row[idx]?.trim() ?? '';
}

export function parseZp21MovimentacaoHtml(html: string): Zp21MovimentacaoSnapshot {
  const previstosTable = extractTableAfterHeading(html, 'Navios Previstos');
  const atracadosTable = extractTableAfterHeading(html, 'Navios Atracados');
  const fundeadosTable = extractTableAfterHeading(html, 'Navios Fundeados');
  const manobrasTable = extractTableAfterHeading(html, 'Manobras previstas');

  const previstos: Zp21NavioPrevisto[] = previstosTable
    ? parseRows(previstosTable).map((r) => ({
        navio: cell(r, 0),
        loa: cell(r, 1),
        calado: cell(r, 2),
        rota: cell(r, 3),
        previsaoChegada: cell(r, 4),
        rebocadores: cell(r, 5),
      }))
    : [];

  const atracados: Zp21NavioAtracado[] = atracadosTable
    ? parseRows(atracadosTable).map((r) => ({
        berco: cell(r, 0),
        bordo: cell(r, 1),
        navio: cell(r, 2),
        rota: cell(r, 3),
        dataHora: cell(r, 4),
      }))
    : [];

  const fundeados: Zp21NavioFundeado[] = fundeadosTable
    ? parseRows(fundeadosTable).map((r) => ({
        navio: cell(r, 0),
        loa: cell(r, 1),
        posicao: cell(r, 2),
        calado: cell(r, 3),
        rota: cell(r, 4),
        dataHora: cell(r, 5),
      }))
    : [];

  const manobrasPrevistas: Zp21ManobraPrevista[] = manobrasTable
    ? parseRows(manobrasTable).map((r) => ({
        data: cell(r, 0),
        horario: cell(r, 1),
        manobra: cell(r, 2),
        berco: cell(r, 3),
        bordo: cell(r, 4),
        navio: cell(r, 5),
        rota: cell(r, 6),
        loa: cell(r, 7),
        boca: cell(r, 8),
        calado: cell(r, 9),
        situacao: cell(r, 10),
      }))
    : [];

  return { previstos, atracados, fundeados, manobrasPrevistas };
}
