export type ContainerTimelineEventType =
  | 'AGENDAMENTO'
  | 'VISTORIA_EIR'
  | 'GATE_IN'
  | 'PATIO_MOVIMENTO'
  | 'GATE_OUT';

export type ContainerTimelineVisibility = 'PUBLIC' | 'ADMIN_ONLY';

export type ContainerTimelineEvent = {
  id: string;
  tipo: ContainerTimelineEventType;
  ocorridoEm: string;
  titulo: string;
  resumo?: string;
  visibilidade: ContainerTimelineVisibility;
  protocolo?: string;
  fotos?: string[];
  metadata?: Record<string, unknown>;
  ric?: {
    disponivel: boolean;
    tipo?: 'ENTRADA' | 'SAIDA';
    gateCheckInId?: string;
    gateCheckOutId?: string;
  };
};

export type ContainerTimelineResponse = {
  iso: string;
  isoFormatado: string;
  geradoEm: string;
  eventos: ContainerTimelineEvent[];
  bloqueios?: Array<{
    tipo: string;
    motivo: string;
    origem: string;
  }>;
};

export type ContainerRicTipo = 'ENTRADA' | 'SAIDA';

export type ContainerRicPayload = {
  tipo: ContainerRicTipo;
  iso: string;
  isoFormatado: string;
  protocolo: string;
  solicitacaoId: string;
  emitidoEm: string;
  terminal: {
    nome: string;
    cnpj?: string;
  };
  transporte: {
    motoristaNome: string;
    motoristaCpf: string;
    placaCavalo: string;
    placaCarreta01: string;
    placaCarreta02?: string | null;
  };
  operador: {
    id: string;
    nome: string;
    email?: string;
  };
  dataHora: string;
  fotos: string[];
  divergencias: unknown[];
  observacoesInternas?: string[];
  assinaturaRicPresente?: boolean;
  hashPdfValidado?: string | null;
};
