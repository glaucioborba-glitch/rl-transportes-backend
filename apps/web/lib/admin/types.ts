export type ContractStatus = "Ativo" | "Expirado" | "Pendente Assinatura";

export type AdminContract = {
  id: string;
  clienteId: string;
  clienteNome: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  condicaoResumo: string;
  sla: {
    gateInMaxH: number;
    gateOutMaxH: number;
    dwellMedEsperadoH: number;
    expedicaoMaxH: number;
  };
  commercial: {
    liftOn: number;
    liftOff: number;
    armazenagem: number;
    taxasExtras: string;
  };
  modeloCobranca: string;
  penalidades: { descricao: string; fator: number; tipoDia: "corridos" | "uteis" }[];
  fingerprint: string;
  versaoDoc: string;
  createdAt: string;
  status: ContractStatus;
};

export type LegalProcess = {
  id: string;
  clienteId: string;
  clienteNome: string;
  tipo: "contratual" | "cobrança" | "contencioso";
  status: "aberto" | "analisando" | "concluído";
  classificacao: string;
  criticidade: "baixa" | "média" | "alta";
  createdAt: string;
};

export type AdminDocCategory = "Contratos" | "Jurídico" | "Financeiro" | "Operacional" | "Compliance";

export type AdminDoc = {
  id: string;
  categoria: AdminDocCategory;
  nome: string;
  createdAt: string;
  blobUrl?: string;
};

export type ServicoInterno = {
  id: string;
  categoria: "TI" | "Manutenção" | "Compras";
  descricao: string;
  criticidade: "baixa" | "média" | "alta";
  responsavel: string;
  status: "aberto" | "andamento" | "concluído";
  createdAt: string;
};

export type SlaInternoTicket = {
  id: string;
  categoria: string;
  abertoEm: string;
  resolvidoEm?: string;
  alvoHoras: number;
};
