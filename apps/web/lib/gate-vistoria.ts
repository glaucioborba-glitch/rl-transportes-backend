export type VistoriaAngulo = "FRENTE" | "TRASEIRA" | "LATERAL_DIREITA" | "LATERAL_ESQUERDA";

export const VISTORIA_ANGULOS: Array<{ id: VistoriaAngulo; label: string; hint: string }> = [
  { id: "FRENTE", label: "Frente", hint: "Porta do contêiner" },
  { id: "TRASEIRA", label: "Traseira", hint: "Lado oposto à porta" },
  { id: "LATERAL_DIREITA", label: "Lateral direita", hint: "Lado direito (motorista)" },
  { id: "LATERAL_ESQUERDA", label: "Lateral esquerda", hint: "Lado esquerdo" },
];

export const AVARIAS_RAPIDAS: Array<{ id: string; label: string }> = [
  { id: "AMASSADO_LATERAL", label: "Amassado lateral" },
  { id: "AMASSADO_TETO", label: "Amassado no teto" },
  { id: "RASGO_LATERAL", label: "Rasgo / furo lateral" },
  { id: "PORTA_DANIFICADA", label: "Porta danificada" },
  { id: "SEM_LACRE", label: "Sem lacre" },
  { id: "LACRE_ROMPIDO", label: "Lacre rompido" },
  { id: "SUJEIRA_EXCESSIVA", label: "Sujeira excessiva" },
  { id: "OUTRA", label: "Outra avaria" },
];

export type VistoriaPortalRow = {
  id: string;
  tipo: "GATE_IN" | "GATE_OUT";
  criadoEm: string;
  avarias: string[];
  fotos: Array<{ id: string; angulo: VistoriaAngulo; url: string }>;
};
