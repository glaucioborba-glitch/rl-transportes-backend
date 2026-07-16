export type GateTurno = "T1" | "T2" | "T3" | "TODOS";

export type GateOsStatus = "PENDENTE" | "EM_EXECUCAO" | "APROVADA" | "REJEITADA";

export type GateCockpitNotificacao = {
  id: string;
  tipo: string;
  mensagem: string;
  em: string;
};

export type GateContainerSituacao = "CHEIO" | "VAZIO";

export type GateFilaChegadaItem = {
  id: string;
  protocolo: string;
  statusDb: string;
  placa: string | null;
  motorista: string | null;
  containersIso: string[];
  tipoCaminhao: string;
  tipoContainer: string | null;
  tipoTamanho: string | null;
  situacao: GateContainerSituacao | null;
  chegadaEm: string;
  fotosPortaria: { caminhao: string[]; container: string[]; documento: string[] };
  cliente: { id: string; razaoSocial: string };
};

export type GateOperacaoAtivaItem = {
  id: string;
  protocolo: string;
  statusDb: string;
  gateInId: string | null;
  placa: string | null;
  motorista: string | null;
  containersIso: string[];
  tipoCaminhao: string;
  tipoTamanho: string | null;
  situacao: GateContainerSituacao | null;
  empilhadeiraAtribuida: string | null;
  operador: string | null;
  osStatus: GateOsStatus;
  osMotivo: string | null;
  entradaEm: string | null;
  liberadoEm: string | null;
  slotBaia: string | null;
  cliente: { id: string; razaoSocial: string };
};

export type GatePatioUnidade = {
  stack: string;
  posicao: string;
  unidadeId: string;
  container: string;
  tipo: string;
  status: string;
  refrigerado: boolean;
  protocolo: string;
  cliente: string;
  diasNoPatio: number;
  entradaEm: string;
};

export type GateDespachoItem = {
  id: string;
  protocolo: string;
  statusDb: string;
  gateInId: string | null;
  placa: string | null;
  motorista: string | null;
  containersIso: string[];
  tipoTamanho: string | null;
  situacao: GateContainerSituacao | null;
  prontoDesde: string;
  cliente: { id: string; razaoSocial: string };
};

export type GateOrdemServicoItem = {
  id: string;
  solicitacaoId: string;
  protocolo: string;
  placa: string | null;
  containersIso: string[];
  operador: string | null;
  osStatus: GateOsStatus;
  duracaoMin: number;
  iniciadaEm: string;
  turno: GateTurno;
};

export type GateCockpitDashboard = {
  autorizacoesPendentes: {
    total: number;
    itens: {
      id: string;
      protocolo: string;
      empresa: string;
      containersIso: string[];
      tipoTamanho: string | null;
      situacao: GateContainerSituacao | null;
      solicitadoEm: string;
      turno: GateTurno | null;
    }[];
  };
  previsaoChegadas: {
    total: number;
    itens: {
      id: string;
      horario: string;
      placa: string | null;
      containersIso: string[];
      empresa: string;
      tipoTamanho: string | null;
      situacao: GateContainerSituacao | null;
      turno: GateTurno;
      statusDb: string;
      chegouPortaria: boolean;
      atrasado: boolean;
    }[];
  };
  previsaoSaidas: {
    total: number;
    itens: {
      id: string;
      horarioPrevisto: string;
      placa: string | null;
      containersIso: string[];
      tipoTamanho: string | null;
      situacao: GateContainerSituacao | null;
      statusLabel: string;
      statusDb: string;
      pronto: boolean;
    }[];
  };
  agendaTurnos: {
    turnoAtual: GateTurno;
    turnos: {
      turno: GateTurno;
      chegadasPrevistas: number;
      chegadasRealizadas: number;
      saidasPrevistas: number;
      saidasRealizadas: number;
      progressoPct: number;
    }[];
  };
  resumoFila: {
    total: number;
    itens: {
      id: string;
      protocolo: string;
      placa: string | null;
      containersIso: string[];
      empresa: string;
      chegadaEm: string;
      tipoTamanho: string | null;
      situacao: GateContainerSituacao | null;
    }[];
  };
  resumoOperacao: {
    total: number;
    itens: {
      id: string;
      protocolo: string;
      containersIso: string[];
      empilhadeira: string | null;
      osStatus: string;
      tipoTamanho: string | null;
      situacao: GateContainerSituacao | null;
    }[];
  };
};

export type GateCockpitPayload = {
  geradoEm: string;
  dataRef: string;
  patio: {
    ocupados: number;
    capacidade: number;
    reefersLigados: number;
    unidades: GatePatioUnidade[];
    alertasDias: number;
  };
  filaChegada: GateFilaChegadaItem[];
  operacaoAtiva: GateOperacaoAtivaItem[];
  despacho: GateDespachoItem[];
  ordensServico: GateOrdemServicoItem[];
  notificacoes: GateCockpitNotificacao[];
  dashboard: GateCockpitDashboard;
};

export type GateCockpitModulo =
  | "dashboard"
  | "fila"
  | "operacao"
  | "patio"
  | "despacho"
  | "os";

export const GATE_MODULO_PATH: Record<Exclude<GateCockpitModulo, "dashboard">, string> = {
  fila: "/operador/gate/fila",
  operacao: "/operador/gate/operacao",
  patio: "/operador/gate/patio",
  despacho: "/operador/gate/despacho",
  os: "/operador/gate/os",
};
