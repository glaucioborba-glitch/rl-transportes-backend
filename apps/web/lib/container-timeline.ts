export type ContainerTimelineEventType =
  | "AGENDAMENTO"
  | "VISTORIA_EIR"
  | "GATE_IN"
  | "PATIO_MOVIMENTO"
  | "GATE_OUT";

export type ContainerTimelineEvent = {
  id: string;
  tipo: ContainerTimelineEventType;
  ocorridoEm: string;
  titulo: string;
  resumo?: string;
  visibilidade?: "PUBLIC" | "ADMIN_ONLY";
  protocolo?: string;
  fotos?: string[];
  metadata?: Record<string, unknown>;
  ric?: {
    disponivel: boolean;
    tipo?: "ENTRADA" | "SAIDA";
    gateCheckInId?: string;
    gateCheckOutId?: string;
  };
};

export type ContainerTimelineResponse = {
  iso: string;
  isoFormatado: string;
  geradoEm: string;
  eventos: ContainerTimelineEvent[];
  bloqueios?: Array<{ tipo: string; motivo: string; origem: string }>;
};

export type ContainerRicPayload = {
  tipo: "ENTRADA" | "SAIDA";
  iso: string;
  isoFormatado: string;
  protocolo: string;
  solicitacaoId: string;
  emitidoEm: string;
  terminal: { nome: string; cnpj?: string };
  transporte: {
    motoristaNome: string;
    motoristaCpf: string;
    placaCavalo: string;
    placaCarreta01: string;
    placaCarreta02?: string | null;
  };
  operador: { id: string; nome: string; email?: string };
  dataHora: string;
  fotos: string[];
  divergencias: unknown[];
  observacoesInternas?: string[];
  assinaturaRicPresente?: boolean;
  hashPdfValidado?: string | null;
};

export const TIMELINE_EVENT_LABELS: Record<ContainerTimelineEventType, string> = {
  AGENDAMENTO: "Agendamento",
  VISTORIA_EIR: "Vistoria / EIR",
  GATE_IN: "Gate-In",
  PATIO_MOVIMENTO: "Pátio",
  GATE_OUT: "Gate-Out",
};
