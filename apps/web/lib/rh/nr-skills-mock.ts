import { hashSeed, pick } from "@/lib/rh/hash";
import type {
  RhColaboradorStatus,
  RhCompetencyCell,
  RhCompetencyId,
  RhNrCode,
  RhNrRecord,
  RhNrStatus,
  RhOperacionalFlags,
  RhTurno,
} from "@/lib/rh/types";

const ROLES: RhTurno[] = ["MANHÃ", "TARDE", "NOITE"];

function isoDaysFromNow(seed: number, base: number): string {
  const d = new Date();
  d.setDate(d.getDate() + base + (seed % 120) - 40);
  return d.toISOString().slice(0, 10);
}

function nrStatusFromSeed(seed: number, i: number): RhNrStatus {
  const r = (seed + i * 17) % 10;
  if (r < 5) return "válido";
  if (r < 8) return "exige reciclagem";
  return "vencido";
}

const NR_DETAIL: Record<RhNrCode, { label: string; inst: string }> = {
  "NR-05": { label: "CIPA", inst: "CSST / Interno" },
  "NR-06": { label: "EPI", inst: "SSMA RL" },
  "NR-11": { label: "Empilhadeiras / RS", inst: "Assoc. Cred." },
  "NR-12": { label: "Segurança em máquinas", inst: "MTE homolog." },
  "NR-17": { label: "Ergonomia", inst: "Ergolab" },
  "NR-20": { label: "Inflamáveis", inst: "ABHP" },
  "NR-23": { label: "Brigada / incêndio", inst: "CETESP" },
  "NR-33": { label: "Espaço confinado", inst: "NR-33 specialist" },
  "NR-35": { label: "Trabalho em altura", inst: "Altus" },
};

export function mockNrPack(id: string, opts?: { admin?: boolean }): RhNrRecord[] {
  const seed = hashSeed(id);
  const codes: RhNrCode[] = opts?.admin
    ? ["NR-05", "NR-06", "NR-17", "NR-23", "NR-35"]
    : ["NR-06", "NR-11", "NR-12", "NR-17", "NR-20", "NR-33", "NR-35"];
  return codes.map((code, i) => {
    const st = nrStatusFromSeed(seed, i + (opts?.admin ? 3 : 0));
    const baseDays = st === "vencido" ? -20 - (i % 15) : st === "exige reciclagem" ? 45 : 200;
    return {
      code,
      label: NR_DETAIL[code].label,
      status: st,
      validade: isoDaysFromNow(seed + i * 31, baseDays),
      instituicao: NR_DETAIL[code].inst,
    };
  });
}

export function summarizeNrCompliance(records: RhNrRecord[]): string {
  if (records.some((r) => r.status === "vencido")) return "Crítico";
  if (records.some((r) => r.status === "exige reciclagem")) return "Reciclagem";
  return "Conforme";
}

export function mockOperacionalProfile(id: string, role: string): RhOperacionalFlags {
  const s = hashSeed(id);
  return {
    patio: role.includes("PATIO") || s % 3 === 0,
    portaria: role.includes("PORTARIA") || s % 4 === 0,
    gate: role.includes("GATE") || s % 5 === 0,
    escolaridade: pick(s, ["Médio comp.", "Superior inc.", "Superior comp.", "Pós / técnico"]),
    cboCargo: pick(s, [
      "7823-10 Motorista",
      "5174-05 Operador logístico",
      "4223-05 Telefonista",
      "5121-05 Empilhador",
    ]),
    tempoCasaMeses: 6 + (s % 84),
    ultimoTreinamento: isoDaysFromNow(s, -(s % 40)),
  };
}

export function inferTurno(id: string, folhaTurno?: string | null): RhTurno | string {
  if (folhaTurno) {
    const u = folhaTurno.toUpperCase();
    if (u.includes("MANH") || u.includes("1")) return "MANHÃ";
    if (u.includes("TARD") || u.includes("2")) return "TARDE";
    if (u.includes("NOIT") || u.includes("NOT") || u.includes("3")) return "NOITE";
    return folhaTurno;
  }
  const s = hashSeed(id);
  return ROLES[s % 3]!;
}

export function inferStatus(dataDemissao?: string | null, id?: string): RhColaboradorStatus {
  if (dataDemissao) return "desligado";
  if (id && hashSeed(id) % 29 === 0) return "afastado";
  return "ativo";
}

export function mockPermissionsForRole(role: string): string[] {
  if (role === "ADMIN") return ["users:*", "auditoria:ler", "relatorios:operacional", "rh:*"];
  if (role === "GERENTE") return ["auditoria:ler", "relatorios:operacional", "rh:ler", "rh:aprovar"];
  if (role === "OPERADOR_PORTARIA") return ["portaria:operar", "solicitacoes:ler"];
  if (role === "OPERADOR_GATE") return ["gate:operar", "solicitacoes:ler"];
  if (role === "OPERADOR_PATIO") return ["patio:operar", "solicitacoes:ler"];
  return ["solicitacoes:ler"];
}

const SKILL_IDS: RhCompetencyId[] = [
  "gate",
  "portaria",
  "patio",
  "empilhadeira",
  "seg_operacional",
  "atendimento",
  "compliance_doc",
];

export function competencyMatrixForUser(
  id: string,
  role: string,
): Record<RhCompetencyId, RhCompetencyCell> {
  const s = hashSeed(id);
  const out = {} as Record<RhCompetencyId, RhCompetencyCell>;
  for (let i = 0; i < SKILL_IDS.length; i++) {
    const k = SKILL_IDS[i]!;
    const r = (s + i * 7 + role.length) % 10;
    if (r < 2) out[k] = "bad";
    else if (r < 5) out[k] = "warn";
    else out[k] = "ok";
  }
  if (role.includes("GATE")) out.gate = "ok";
  if (role.includes("PORTARIA")) out.portaria = "ok";
  if (role.includes("PATIO")) {
    out.patio = "ok";
    out.empilhadeira = out.empilhadeira === "bad" ? "warn" : out.empilhadeira;
  }
  return out;
}

export function elegibilidadeOperacionalLabel(args: {
  matrix: Record<RhCompetencyId, RhCompetencyCell>;
  nr: RhNrRecord[];
  status: RhColaboradorStatus;
}): "APTO" | "EM RECICLAGEM" | "NÃO APTO" {
  if (args.status !== "ativo") return "NÃO APTO";
  if (args.nr.some((n) => n.status === "vencido")) return "NÃO APTO";
  if (args.nr.some((n) => n.status === "exige reciclagem")) return "EM RECICLAGEM";
  const vals = Object.values(args.matrix);
  if (vals.some((v) => v === "bad")) return "NÃO APTO";
  if (vals.some((v) => v === "warn")) return "EM RECICLAGEM";
  return "APTO";
}

export const RH_COMPETENCY_LABELS: Record<RhCompetencyId, string> = {
  gate: "Gate Operation",
  portaria: "Portaria",
  patio: "Pátio / Yard",
  empilhadeira: "Empilhadeira / RS",
  seg_operacional: "Segurança operacional",
  atendimento: "Atendimento ao cliente",
  compliance_doc: "Compliance documental",
};

export function trainingCoursesCatalog(): {
  code: RhNrCode;
  nome: string;
  cargaHoraria: number;
  validadeMeses: number;
  instituicao: string;
}[] {
  return [
    { code: "NR-05", nome: "Formação CIPA", cargaHoraria: 4, validadeMeses: 12, instituicao: "Interno" },
    { code: "NR-06", nome: "EPI & EPV", cargaHoraria: 8, validadeMeses: 12, instituicao: "SSMA" },
    { code: "NR-11", nome: "Movimentação RS", cargaHoraria: 16, validadeMeses: 24, instituicao: "SENAI" },
    { code: "NR-12", nome: "Segurança em máquinas", cargaHoraria: 8, validadeMeses: 24, instituicao: "CREA" },
    { code: "NR-17", nome: "Ergonomia administrativa", cargaHoraria: 4, validadeMeses: 36, instituicao: "Ergolab" },
    { code: "NR-23", nome: "Brigada de incêndio", cargaHoraria: 24, validadeMeses: 24, instituicao: "CBPM" },
    { code: "NR-35", nome: "Trabalho em altura", cargaHoraria: 8, validadeMeses: 24, instituicao: "Altus" },
  ];
}
