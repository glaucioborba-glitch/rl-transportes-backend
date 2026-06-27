/** Models with direct tenant_id column — auto-filtered by Prisma extension. */
export const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Cliente',
  'Solicitacao',
  'Funcionario',
  'AuditLog',
  'Fatura',
  'Faturamento',
  'AgendamentoTerminal',
  'GateCheckIn',
  'TabelaPreco',
]);

export const DEFAULT_TENANT_ID = 'default';
