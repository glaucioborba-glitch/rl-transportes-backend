/** Chaves expostas na API / decorator @PessoaPode. */
export type PessoaPermissaoKey =
  | 'criarSolicitacao'
  | 'anexarDocumentos'
  | 'agendarTurno'
  | 'visualizarFinanceiro'
  | 'aprovarOS'
  | 'verOS'
  | 'alterarGate'
  | 'gerarPDF'
  | 'gerenciarPessoas';

export type PermissoesPessoaSession = {
  podeCriarSolicitacao: boolean;
  podeAnexarDocumentos: boolean;
  podeAgendarTurno: boolean;
  podeVisualizarFinanceiro: boolean;
  podeAprovarOS: boolean;
  podeVerOS: boolean;
  podeAlterarDadosGate: boolean;
  podeGerarPDF: boolean;
  podeGerenciarPessoas: boolean;
};

export const PERMISSAO_KEY_TO_FIELD: Record<PessoaPermissaoKey, keyof PermissoesPessoaSession> = {
  criarSolicitacao: 'podeCriarSolicitacao',
  anexarDocumentos: 'podeAnexarDocumentos',
  agendarTurno: 'podeAgendarTurno',
  visualizarFinanceiro: 'podeVisualizarFinanceiro',
  aprovarOS: 'podeAprovarOS',
  verOS: 'podeVerOS',
  alterarGate: 'podeAlterarDadosGate',
  gerarPDF: 'podeGerarPDF',
  gerenciarPessoas: 'podeGerenciarPessoas',
};

export function defaultPermissoesPessoa(): PermissoesPessoaSession {
  return {
    podeCriarSolicitacao: true,
    podeAnexarDocumentos: true,
    podeAgendarTurno: true,
    podeVisualizarFinanceiro: false,
    podeAprovarOS: false,
    podeVerOS: true,
    podeAlterarDadosGate: false,
    podeGerarPDF: true,
    podeGerenciarPessoas: false,
  };
}

export function permissoesFromRow(row: {
  podeCriarSolicitacao: boolean;
  podeAnexarDocumentos: boolean;
  podeAgendarTurno: boolean;
  podeVisualizarFinanceiro: boolean;
  podeAprovarOS: boolean;
  podeVerOS: boolean;
  podeAlterarDadosGate: boolean;
  podeGerarPDF: boolean;
  podeGerenciarPessoas: boolean;
}): PermissoesPessoaSession {
  return {
    podeCriarSolicitacao: row.podeCriarSolicitacao,
    podeAnexarDocumentos: row.podeAnexarDocumentos,
    podeAgendarTurno: row.podeAgendarTurno,
    podeVisualizarFinanceiro: row.podeVisualizarFinanceiro,
    podeAprovarOS: row.podeAprovarOS,
    podeVerOS: row.podeVerOS,
    podeAlterarDadosGate: row.podeAlterarDadosGate,
    podeGerarPDF: row.podeGerarPDF,
    podeGerenciarPessoas: row.podeGerenciarPessoas,
  };
}

export function hasPermissao(
  permissoes: PermissoesPessoaSession,
  key: PessoaPermissaoKey,
): boolean {
  const field = PERMISSAO_KEY_TO_FIELD[key];
  return !!permissoes[field];
}
