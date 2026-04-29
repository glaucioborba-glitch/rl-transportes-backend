export type ControlEfficacy = "efetivo" | "parcial" | "inefetivo";

export type ControlRowEfficacy = {
  id: string;
  processo: string;
  risco: string;
  controle: string;
  procedimento: string;
  evidencia: string;
  periodicidade: string;
  dono: string;
  eficacia: ControlEfficacy;
};

export type ControlEffectivenessStatus = "aprovado" | "reprovado" | "revisao";

export type EffectivenessTriple = {
  design: ControlEffectivenessStatus;
  execucao: ControlEffectivenessStatus;
  evidencias: ControlEffectivenessStatus;
};

export type IsoRiskCategory = "operacional" | "financeiro" | "legal" | "estrategico" | "compliance";

export type RiskRegisterRow = {
  id: string;
  risco: string;
  categoria: IsoRiskCategory;
  causaRaiz: string;
  impacto: number;
  probabilidade: number;
  nivel: number;
  dono: string;
  mitigacao: string;
  origem?: string;
};

export type RiskTreatmentType = "tolerar" | "tratar" | "transferir" | "terminar";

export type MatrixPlotPoint = {
  id: string;
  label: string;
  p: number;
  i: number;
  source: "local" | "api";
};
