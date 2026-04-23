import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  isArray: () => false,
});

function pickText(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && '#text' in v) {
    return String((v as { '#text': string })['#text']);
  }
  return undefined;
}

function dig(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function collectErros(parsed: Record<string, unknown>): string[] {
  const out: string[] = [];
  const msg = dig(parsed, 'nfse', 'mensagem') ?? dig(parsed, 'mensagem') ?? dig(parsed, 'retorno', 'mensagem');
  if (msg && typeof msg === 'object') {
    const erros = (msg as Record<string, unknown>)['erro'];
    const list = Array.isArray(erros) ? erros : erros != null ? [erros] : [];
    for (const e of list) {
      const t = pickText(e) ?? (typeof e === 'string' ? e : JSON.stringify(e));
      if (t) out.push(t);
    }
  }
  const flatErr = dig(parsed, 'nfse', 'erro') ?? dig(parsed, 'erro');
  if (typeof flatErr === 'string') out.push(flatErr);
  return out;
}

export type IpmEmissaoSucesso = {
  numeroNfse: string;
  serieNfse?: string;
  linkNfse?: string;
  codVerificadorAutenticidade?: string;
  chaveAcessoNfseNacional?: string;
  situacaoCodigo?: string;
  situacaoDescricao?: string;
};

/**
 * Interpreta retorno IPM. Erros em &lt;mensagem&gt;&lt;erro&gt; (NTE-35).
 * @param operacao ajusta critério de sucesso (cancelamento: situação 2 = cancelada).
 */
export function parseIpmNfseXmlRetorno(
  xmlRaw: string,
  operacao: 'emissao' | 'cancelamento' | 'consulta' = 'emissao',
): {
  sucesso: boolean;
  emissao?: IpmEmissaoSucesso;
  erros: string[];
  cancelamentoSituacao?: 'aprovado' | 'rejeitado' | 'pendente';
} {
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlRaw) as Record<string, unknown>;
  } catch {
    return { sucesso: false, erros: ['Resposta XML inválida do provedor.'] };
  }

  const erros = collectErros(parsed);
  const ignoraInfoSucesso = (line: string) => /^\[\s*1\s*\]\s*Sucesso/i.test(line.trim());
  const errosFatais = erros.filter((e) => !ignoraInfoSucesso(e));

  const root = (dig(parsed, 'nfse') as Record<string, unknown> | undefined) ?? parsed;
  const nf = (dig(root, 'nf') as Record<string, unknown> | undefined) ?? (dig(parsed, 'nfse', 'nf') as Record<string, unknown> | undefined);

  const numeroNfse = pickText(nf?.['numero_nfse']) ?? pickText(nf?.['Numero_Nfse']);
  const link = pickText(nf?.['link_nfse']);
  const cod = pickText(nf?.['cod_verificador_autenticidade']);
  const chave = pickText(nf?.['chave_acesso_nfse_nacional']);
  const situacaoCodigo = pickText(nf?.['situacao_codigo_nfse']) ?? pickText(nf?.['situacao_codigo']);
  const situacaoDescricao = pickText(nf?.['situacao_descricao_nfse']) ?? pickText(nf?.['situacao_descricao']);
  const serie = pickText(nf?.['serie_nfse']);

  let cancelamentoSituacao: 'aprovado' | 'rejeitado' | 'pendente' | undefined;
  const ped = dig(root, 'pedido_cancelamento') ?? dig(parsed, 'pedido_cancelamento');
  if (ped && typeof ped === 'object') {
    const st = pickText((ped as Record<string, unknown>)['situacao']);
    if (st) {
      const u = st.toUpperCase();
      if (u.includes('APROV')) cancelamentoSituacao = 'aprovado';
      else if (u.includes('REJEIT') || u.includes('NEG')) cancelamentoSituacao = 'rejeitado';
      else if (u.includes('PEND')) cancelamentoSituacao = 'pendente';
    }
  }

  const emitida =
    !!numeroNfse && (situacaoCodigo === undefined || situacaoCodigo === '1' || situacaoDescricao === 'Emitida');
  const cancelada = situacaoCodigo === '2' || situacaoDescricao === 'Cancelada';
  const consultaOk = !!numeroNfse;
  if (errosFatais.length > 0) {
    return { sucesso: false, erros: errosFatais, cancelamentoSituacao };
  }

  if (operacao === 'cancelamento' && cancelamentoSituacao === 'pendente') {
    return { sucesso: false, erros: [], cancelamentoSituacao: 'pendente' };
  }

  const notaOk =
    operacao === 'consulta'
      ? consultaOk
      : operacao === 'cancelamento'
        ? (!!numeroNfse && cancelada) || cancelamentoSituacao === 'aprovado'
        : emitida;
  const sucesso = notaOk;

  if (!sucesso) {
    if (!numeroNfse) {
      return { sucesso: false, erros: ['Não foi possível interpretar o retorno do provedor.'], cancelamentoSituacao };
    }
    return {
      sucesso: false,
      erros:
        operacao === 'emissao'
          ? ['NFS-e não está em situação emitida no retorno.']
          : operacao === 'cancelamento'
            ? ['Cancelamento não concluído no retorno do provedor.']
            : ['Consulta não retornou dados esperados.'],
      cancelamentoSituacao,
    };
  }

  return {
    sucesso: true,
    erros: [],
    emissao: {
      numeroNfse: numeroNfse!,
      serieNfse: serie,
      linkNfse: link,
      codVerificadorAutenticidade: cod,
      chaveAcessoNfseNacional: chave,
      situacaoCodigo,
      situacaoDescricao,
    },
    cancelamentoSituacao,
  };
}
