export type ClassificacaoAuditoria = 'VERDE' | 'AMARELO' | 'VERMELHO';

const ACAO_VERMELHA =
  /FATURA|BOLETO|NFSE|NFS_|PRE_FATURA|PARAMETROS|CESSAO|BLOQUEIO|EXCLUID|DELETE|CANCELAMENTO_TARDIO|SEGURANCA/i;
const ACAO_AMARELA =
  /ALTERAD|UPDATE|CORREC|CADASTRO_ALTERADO|SOLICITACAO_ALTERADA|CLIENTE_ALTERADO|REGISTRO_ALTERADO/i;
const TABELA_CRITICA = /fatur|boleto|nfs|parametro|pre_fatura|cessao|conta_corrente|contacorrente/i;
const PAYLOAD_SENHA =
  /gerentetoken|gerenteid|gerenteemail|supervisor|autorizacaogerente|exigiusenha|"password"/i;

export const CLASSIFICACAO_AUDITORIA_LABEL: Record<
  ClassificacaoAuditoria,
  { titulo: string; descricao: string }
> = {
  VERDE: {
    titulo: 'Normais',
    descricao: 'Inclusões, solicitações e processos comuns do sistema.',
  },
  AMARELO: {
    titulo: 'Alterações',
    descricao: 'Mudança em dado que já estava gravado (laranja na trilha).',
  },
  VERMELHO: {
    titulo: 'Críticas',
    descricao: 'Exigem senha de gestor ou alteram fluxo, faturamento, parâmetros ou valores manuais.',
  },
};

function textoPayload(value: unknown): string {
  if (value == null) return '';
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return '';
  }
}

export function payloadExigeSenha(...payloads: unknown[]): boolean {
  return payloads.some((p) => PAYLOAD_SENHA.test(textoPayload(p)));
}

/** Verde = rotina; amarelo = edição de dado existente; vermelho = senha / faturamento / fluxo. */
export function classificarAcaoAuditoria(input: {
  acao: string;
  categoria?: string | null;
  tabela?: string | null;
  dadosNovos?: unknown;
  dadosAnteriores?: unknown;
}): ClassificacaoAuditoria {
  const acao = String(input.acao ?? '').trim();
  if (acao === 'SEGURANCA' || acao === 'DELETE') {
    return 'VERMELHO';
  }
  if (payloadExigeSenha(input.dadosNovos, input.dadosAnteriores)) {
    return 'VERMELHO';
  }
  if (TABELA_CRITICA.test(String(input.tabela ?? '')) && acao !== 'READ') {
    return 'VERMELHO';
  }
  if (ACAO_VERMELHA.test(acao)) return 'VERMELHO';
  if (ACAO_AMARELA.test(acao) || acao === 'UPDATE') return 'AMARELO';
  return 'VERDE';
}

export function acoesSqlClassificacao(classificacao: ClassificacaoAuditoria): {
  vermelha: RegExp;
  amarela: RegExp;
} {
  void classificacao;
  return { vermelha: ACAO_VERMELHA, amarela: ACAO_AMARELA };
}

export function acaoCombinaClassificacao(
  acao: string,
  classificacao: ClassificacaoAuditoria,
): boolean {
  if (classificacao === 'VERMELHO') return ACAO_VERMELHA.test(acao);
  if (classificacao === 'AMARELO') return ACAO_AMARELA.test(acao) && !ACAO_VERMELHA.test(acao);
  return !ACAO_VERMELHA.test(acao) && !ACAO_AMARELA.test(acao);
}
