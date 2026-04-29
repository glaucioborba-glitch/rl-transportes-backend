import type {
  ControlRowEfficacy,
  EffectivenessTriple,
  RiskRegisterRow,
  RiskTreatmentType,
} from "./types";

export const K = {
  controlMatrix: "rl_grc_controls_matrix_v1",
  effectiveness: "rl_grc_effectiveness_v1",
  riskRegister: "rl_grc_risk_register_v1",
  treatments: "rl_grc_treatments_v1",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(v));
}

export const defaultControlRows: Omit<ControlRowEfficacy, never>[] = [
  {
    id: "op",
    processo: "Operações (fluxo completo)",
    risco: "Falha na cadeia portaria→saída",
    controle: "Segregação de funções + trilha em auditoria",
    procedimento: "POP Operações v3",
    evidencia: "Logs Prisma + checkpoints",
    periodicidade: "Contínuo",
    dono: "Gerente Administrativo",
    eficacia: "efetivo",
  },
  {
    id: "gate",
    processo: "Gate",
    risco: "Registro sem portaria prévia",
    controle: "Validação de pré-requisitos no fluxo",
    procedimento: "Gate ISO / vínculo solicitação",
    evidencia: "Conflitos dashboard",
    periodicidade: "Diária",
    dono: "Coord. Gate",
    eficacia: "parcial",
  },
  {
    id: "pat",
    processo: "Pátio",
    risco: "Saturação e manobras",
    controle: "Quadra + ocupação monitorada",
    procedimento: "Capacidade pátio performance",
    evidencia: "Ocupação %",
    periodicidade: "Hora",
    dono: "Coord. Pátio",
    eficacia: "parcial",
  },
  {
    id: "fin",
    processo: "Financeiro",
    risco: "Inadimplência e concentração",
    controle: "Curva ABC + aging",
    procedimento: "Ciclo faturamento/boletos",
    evidencia: "Dashboard financeiro",
    periodicidade: "Mensal",
    dono: "CFO / Controller",
    eficacia: "efetivo",
  },
  {
    id: "rh",
    processo: "RH",
    risco: "Competência e jornada",
    controle: "Cadastro + folha (quando disponível)",
    procedimento: "POP RH",
    evidencia: "Auditoria users",
    periodicidade: "Mensal",
    dono: "Gerente RH",
    eficacia: "parcial",
  },
];

export function grcStorageControls(): ControlRowEfficacy[] {
  const cur = read<ControlRowEfficacy[]>(K.controlMatrix, []);
  if (cur.length) return cur;
  write(K.controlMatrix, defaultControlRows);
  return defaultControlRows;
}

export function grcSetControls(rows: ControlRowEfficacy[]) {
  write(K.controlMatrix, rows);
}

export function grcGetEffectiveness(): Record<string, EffectivenessTriple> {
  return read(K.effectiveness, {});
}

export function grcSetEffectiveness(m: Record<string, EffectivenessTriple>) {
  write(K.effectiveness, m);
}

export function grcRiskRegister(): RiskRegisterRow[] {
  return read(K.riskRegister, []);
}

export function grcSetRiskRegister(rows: RiskRegisterRow[]) {
  write(K.riskRegister, rows);
}

export function grcTreatments(): { id: string; riscoId: string; strategy: RiskTreatmentType; nota: string }[] {
  return read(K.treatments, []);
}

export function grcSetTreatments(rows: { id: string; riscoId: string; strategy: RiskTreatmentType; nota: string }[]) {
  write(K.treatments, rows);
}
