export type IncidentType = "quase_acidente" | "acidente" | "desvio" | "critico";

export type IncidentLocation = "portaria" | "gate" | "patio" | "empilhadeira" | "administrativo";

export type RiskLevel = "baixo" | "medio" | "alto";

export type IncidentRecord = {
  id: string;
  createdAt: string;
  tipo: IncidentType;
  local: IncidentLocation;
  envolvidosIds: string[];
  envolvidosLabels: string[];
  riscoPercebido: RiskLevel;
  descricao: string;
  evidenciasBase64: string[];
  impactoOperacional: string;
  classificacaoPfmea: string;
};

export type Investigation5w2h = {
  what: string;
  who: string;
  where: string;
  when: string;
  why: string;
  how: string;
  howMuch: string;
};

export type IshikawaBranches = {
  metodo: string;
  maquina: string;
  material: string;
  maoObra: string;
  meioAmbiente: string;
  medicao: string;
};

export type TimelineStep = { id: string; label: string; date: string; detail: string };

export type CatalogRiskItem = {
  id: string;
  titulo: string;
  fonte: string;
  probabilidade: number;
  severidade: number;
  score: number;
  nota?: string;
};

export type PtwType = "altura" | "empilhadeira" | "confinado" | "manutencao" | "patio_risco";

export type PtwStatus = "rascunho" | "enviado" | "aprovado" | "encerrado";

export type PtwRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: PtwStatus;
  tipo: PtwType;
  solicitante: string;
  executor: string;
  area: string;
  risco: string;
  nrAplicavel: string;
  episObrigatorios: string[];
  epcsObrigatorios: string[];
  assinaturaBase64: string | null;
  validadeAte: string;
};

export type ChecklistItem = {
  id: string;
  tarefa: string;
  status: "pendente" | "ok" | "na";
  notas: string;
  fotosBase64: string[];
};

export type ActionPlanRow = {
  id: string;
  who: string;
  what: string;
  where: string;
  when: string;
  why: string;
  how: string;
  howMuch: string;
  status: "aberto" | "em_andamento" | "fechado";
};
