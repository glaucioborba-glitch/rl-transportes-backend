import type { PermissoesPessoaSession } from '../../pessoas-permissoes/pessoa-permissoes.types';

/** Permissões fixas (read-only) para transportadoras terceirizadas — delegação operacional B2B. */
export const TRANSPORTADORA_PERMISSOES_FIXAS: PermissoesPessoaSession = {
  podeCriarSolicitacao: true,
  podeAnexarDocumentos: true,
  podeAgendarTurno: true,
  podeVisualizarFinanceiro: false,
  podeAprovarOS: false,
  podeVerOS: true,
  podeAlterarDadosGate: true,
  podeGerarPDF: true,
  podeGerenciarPessoas: false,
};

export const TRANSPORTADORA_PERMISSOES_UI = {
  ativas: [
    { key: 'podeCriarSolicitacao', label: 'Criar solicitações' },
    { key: 'podeAgendarTurno', label: 'Agendar turno' },
    { key: 'podeGerarPDF', label: 'Gerar PDF' },
    { key: 'podeAnexarDocumentos', label: 'Anexar documentos' },
    { key: 'podeAlterarDadosGate', label: 'Alterar dados no gate' },
  ],
  inativas: [
    { key: 'podeVisualizarFinanceiro', label: 'Visualizar financeiro' },
    { key: 'podeGerenciarPessoas', label: 'Gerenciar pessoas' },
    { key: 'podeAprovarOS', label: 'Aprovar OS' },
  ],
} as const;
