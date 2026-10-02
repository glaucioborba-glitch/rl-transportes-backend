/** Models with direct tenant_id column — auto-filtered by Prisma extension. */
export const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Cliente',
  'Solicitacao',
  'Funcionario',
  'AuditLog',
  'Fatura',
  'FaturaPacote',
  'Faturamento',
  'ClienteContaCorrenteLancamento',
  'ClientePixCreditoComprovante',
  'AgendamentoTerminal',
  'GateCheckIn',
  'TabelaPreco',
  'CatalogoMotoristaExterno',
  'CadastroMotorista',
  'CadastroColaborador',
  'RhTurnoJornada',
  'CadastroTransportadora',
  'CadastroTerceiro',
  'CadastroBanco',
  'ColaboradorFamiliar',
  'TesourariaFornecedor',
  'FolhaColaboradorRh',
  'MotoristaPosicao',
  'MotoristaBiometria',
  // Vazavam entre terminais: tabela de preço listada sem filtro e processo
  // encontrado só pelo ISO (dois terminais com o mesmo contêiner colidiam).
  'CadastroTabelaPreco',
  'UnidadeProcesso',
  'SolicitacaoAluguel',
  'PatioFilaTarefa',
]);

export const DEFAULT_TENANT_ID = 'default';
