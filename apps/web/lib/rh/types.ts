export type RhStaffRole =
  | "ADMIN"
  | "GERENTE"
  | "OPERADOR_PORTARIA"
  | "OPERADOR_GATE"
  | "OPERADOR_PATIO";

export type RhTurno = "MANHÃ" | "TARDE" | "NOITE";

export type RhColaboradorStatus = "ativo" | "desligado" | "afastado";

export type RhNrStatus = "válido" | "vencido" | "exige reciclagem";

export type RhNrCode =
  | "NR-05"
  | "NR-06"
  | "NR-11"
  | "NR-12"
  | "NR-17"
  | "NR-20"
  | "NR-23"
  | "NR-33"
  | "NR-35";

export type RhNrRecord = {
  code: RhNrCode;
  label: string;
  status: RhNrStatus;
  validade: string;
  instituicao: string;
  docUrl?: string;
};

export type RhOperacionalFlags = {
  patio: boolean;
  portaria: boolean;
  gate: boolean;
  escolaridade: string;
  cboCargo: string;
  tempoCasaMeses: number;
  ultimoTreinamento: string;
};

export type RhColaboradorDirectoryItem = {
  id: string;
  source: "api_user" | "merged" | "folha_only" | "dashboard_only";
  nome: string;
  email: string | null;
  role: string;
  permissions: string[];
  status: RhColaboradorStatus;
  turno: RhTurno | string;
  ultimoAcesso: string | null;
  operacoes24h: number | null;
  cpf: string | null;
  cargo: string | null;
  dataAdmissao: string | null;
  aptidaoLabel: string;
  complianceNrLabel: string;
};

export type RhCompetencyId =
  | "gate"
  | "portaria"
  | "patio"
  | "empilhadeira"
  | "seg_operacional"
  | "atendimento"
  | "compliance_doc";

export type RhCompetencyCell = "ok" | "warn" | "bad";
