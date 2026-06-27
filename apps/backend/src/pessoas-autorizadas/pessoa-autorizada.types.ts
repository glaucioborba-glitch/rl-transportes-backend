/** Snapshot da pessoa autorizada gravado na sessão Redis (sem alterar JWT). */
export type PessoaAutorizadaSession = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
};

export type PessoaAuditMeta = {
  cnpj: string;
  pessoaId: string;
  nome: string;
  email: string;
  telefone: string | null;
};
