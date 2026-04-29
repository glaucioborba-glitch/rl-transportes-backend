/**
 * Normalização de linhas de extrato (OFX/CSV/API futura).
 */

export type TipoExtratoMovimento = 'CREDITO' | 'DEBITO';

export interface ExtratoLinhaNormalizada {
  /** Linha estável dentro do lote: `{batchId}:{índice}` */
  idLinha: string;
  batchId: string;
  indice: number;
  dataLancamento: string;
  historico: string;
  valor: number;
  tipo: TipoExtratoMovimento;
  saldoParcial?: number;
  documento?: string;
  nossoNumero?: string;
  fitId?: string;
}

export interface ExtratoLoteMeta {
  batchId: string;
  formato: 'OFX' | 'CSV' | 'API';
  nomeOrigem?: string;
  importadoEm: string;
  linhasCount: number;
}

/** Parser OFX 1.x (subset: STMTTRN). */
export function parseOfxExtrato(conteudo: string, batchId: string): ExtratoLinhaNormalizada[] {
  const texto = conteudo.replace(/\r\n/g, '\n');
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const out: ExtratoLinhaNormalizada[] = [];

  const tag = (block: string, name: string): string | undefined => {
    const re = new RegExp(`<${name}>([^<\\n]+)`, 'i');
    const m = block.match(re);
    return m?.[1]?.trim();
  };

  blocos.forEach((bloco, idx) => {
    const amtRaw = tag(bloco, 'TRNAMT');
    const dtRaw = tag(bloco, 'DTPOSTED') ?? tag(bloco, 'DTUSER');
    const memo = tag(bloco, 'MEMO') ?? tag(bloco, 'NAME') ?? '';
    const fitId = tag(bloco, 'FITID');
    const check = tag(bloco, 'CHECKNUM');

    if (amtRaw === undefined || dtRaw === undefined) return;

    const amt = parseFloat(amtRaw.replace(',', '.'));
    if (!Number.isFinite(amt)) return;

    const tipo: TipoExtratoMovimento = amt >= 0 ? 'CREDITO' : 'DEBITO';
    const valor = Math.round(Math.abs(amt) * 100) / 100;

    let dataIso = dtRaw;
    if (/^\d{8}/.test(dtRaw)) {
      const y = dtRaw.slice(0, 4);
      const m = dtRaw.slice(4, 6);
      const d = dtRaw.slice(6, 8);
      dataIso = `${y}-${m}-${d}`;
    }

    const historico = [memo, check ? `DOC:${check}` : ''].filter(Boolean).join(' | ');

    out.push({
      idLinha: `${batchId}:${idx}`,
      batchId,
      indice: idx,
      dataLancamento: dataIso,
      historico: historico || '(sem histórico)',
      valor,
      tipo,
      fitId,
      documento: check ?? undefined,
    });
  });

  return out;
}

/**
 * CSV esperado (cabeçalho opcional):
 * data,valor,historico[,tipo][,documento]
 * data: YYYY-MM-DD ou DD/MM/YYYY
 * valor: usar vírgula ou ponto decimal; linhas DEBITO com valor negativo ou coluna tipo
 */
export function parseCsvExtrato(conteudo: string, batchId: string): ExtratoLinhaNormalizada[] {
  const linhas = conteudo.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return [];

  const primeira = linhas[0]!;
  const sep = primeira.includes(';') ? ';' : ',';
  const temHeader = /data|valor|histor/i.test(primeira);

  const dados = temHeader ? linhas.slice(1) : linhas;
  const out: ExtratoLinhaNormalizada[] = [];

  const parseData = (s: string): string => {
    const t = s.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return t;
  };

  const parseValorMonetario = (raw: string): number => {
    const t = (raw ?? '').trim();
    if (!t) return NaN;
    if (/^-?\d+,\d{2}$/.test(t) || (t.includes(',') && !/\.\d{2}$/.test(t))) {
      return parseFloat(t.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(t.replace(',', '.'));
  };

  dados.forEach((linha, idx) => {
    const cols = linha.split(sep).map((c) => c.trim());
    if (cols.length < 3) return;

    const dataLancamento = parseData(cols[0] ?? '');
    const valorBruto = cols[1] ?? '0';
    let valor = Math.abs(parseValorMonetario(valorBruto));
    let tipoCol = (cols[3] ?? '').toUpperCase();
    const hist = cols[2] ?? '';

    let tipo: TipoExtratoMovimento =
      tipoCol.includes('DEB') || tipoCol === 'D'
        ? 'DEBITO'
        : tipoCol.includes('CRED') || tipoCol === 'C'
          ? 'CREDITO'
          : parseValorMonetario(valorBruto) < 0
            ? 'DEBITO'
            : 'CREDITO';

    if (!Number.isFinite(valor)) return;

    out.push({
      idLinha: `${batchId}:${idx}`,
      batchId,
      indice: idx,
      dataLancamento,
      historico: hist,
      valor: Math.round(valor * 100) / 100,
      tipo,
      documento: cols[4]?.trim() || undefined,
    });
  });

  return out;
}
