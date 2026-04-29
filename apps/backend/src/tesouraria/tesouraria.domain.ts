/** Domínio tesouraria (Fase 10 — persistência em memória até migração Prisma). */

export type CategoriaDespesa =
  | 'OPEX'
  | 'CAPEX'
  | 'IMPOSTOS'
  | 'MANUTENCAO'
  | 'SERVICOS'
  | 'TI'
  | 'FROTA';

export type StatusDespesaPersistido = 'pendente' | 'pago' | 'atrasado';

export type RecorrenciaDespesa = 'nenhuma' | 'mensal' | 'anual';

export type CategoriaFornecedor =
  | 'energia'
  | 'TI'
  | 'manutencao'
  | 'seguranca'
  | 'transporte'
  | 'geral';

export type TipoContrato = 'mensal' | 'anual' | 'SLA' | 'servico';

export interface FornecedorEntity {
  id: string;
  nome: string;
  cnpj: string;
  categoriaFornecedor: CategoriaFornecedor;
  contato: string;
  prazoPagamentoPadrao: number;
  createdAt: string;
}

export interface DespesaEntity {
  id: string;
  fornecedor: string;
  categoria: CategoriaDespesa;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusDespesaPersistido;
  recorrencia: RecorrenciaDespesa;
  documentoReferencia?: string;
  createdAt: string;
}

export interface ContratoEntity {
  id: string;
  fornecedorId: string;
  tipoContrato: TipoContrato;
  valorFixo: number;
  vigenciaInicio: string;
  vigenciaFim: string;
  reajusteAnualPct: number;
  observacoes?: string;
  createdAt: string;
}

export interface MesValorFin {
  mes: string;
  valor: number;
}
