/** Pacote bruto produzido pela fase `extrair` (antes de Kimball). */

export interface ExtractCliente {
  id: string;
  nome: string;
  tipo: string;
}

export interface ExtractSolicitacao {
  id: string;
  clienteId: string;
  protocolo: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  qtUnidades: number;
  hasPortaria: boolean;
  hasGate: boolean;
  hasPatio: boolean;
  hasSaida: boolean;
  gateRicAssinado: boolean;
  saidaEm: Date | null;
}

export interface ExtractFaturamento {
  id: string;
  clienteId: string;
  periodo: string;
  valorTotal: number;
  createdAt: Date;
  qtItens: number;
}

export interface ExtractBoleto {
  id: string;
  clienteId: string;
  valor: number;
  vencimento: Date;
  statusPagamento: string;
}

export interface ExtractNfse {
  id: string;
  faturamentoId: string;
  clienteId: string;
  statusIpm: string;
  createdAt: Date;
}

export interface ExtractUsuarioRh {
  id: string;
  role: string;
}

export interface RawExtractBundle {
  extraidoEm: string;
  duracaoMs: number;
  clientes: ExtractCliente[];
  solicitacoes: ExtractSolicitacao[];
  faturamentos: ExtractFaturamento[];
  boletos: ExtractBoleto[];
  nfs: ExtractNfse[];
  usuariosInternos: ExtractUsuarioRh[];
  auditoriaLinhas: number;
}
