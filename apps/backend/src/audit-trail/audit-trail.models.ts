/** Modelos Prisma auditados via extension (update/delete). */
export const AUDITED_PRISMA_MODELS = [
  'Fatura',
  'Solicitacao',
  'BloqueioContainer',
  'Cliente',
  'Boleto',
  'NfsEmitida',
  'PreFatura',
  'CadastroBanco',
  'CadastroColaborador',
  'CadastroMotorista',
  'CadastroTransportadora',
  'CadastroEquipamento',
] as const;

export type AuditedPrismaModel = (typeof AUDITED_PRISMA_MODELS)[number];

/** Chave delegate no Prisma Client (camelCase). */
export const AUDITED_MODEL_DELEGATES: Record<AuditedPrismaModel, string> = {
  Fatura: 'fatura',
  Solicitacao: 'solicitacao',
  BloqueioContainer: 'bloqueioContainer',
  Cliente: 'cliente',
  Boleto: 'boleto',
  NfsEmitida: 'nfsEmitida',
  PreFatura: 'preFatura',
  CadastroBanco: 'cadastroBanco',
  CadastroColaborador: 'cadastroColaborador',
  CadastroMotorista: 'cadastroMotorista',
  CadastroTransportadora: 'cadastroTransportadora',
  CadastroEquipamento: 'cadastroEquipamento',
};
