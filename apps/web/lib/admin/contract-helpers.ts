import type { AdminContract, ContractStatus } from "@/lib/admin/types";

export function contractStatusFromDates(vigenciaFim: string): ContractStatus {
  const end = new Date(vigenciaFim);
  if (Number.isNaN(end.getTime())) return "Pendente Assinatura";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end < today) return "Expirado";
  return "Ativo";
}

export function stableContractPayload(c: Omit<AdminContract, "fingerprint" | "versaoDoc" | "createdAt" | "id">) {
  return JSON.stringify({
    clienteId: c.clienteId,
    vigenciaInicio: c.vigenciaInicio,
    vigenciaFim: c.vigenciaFim,
    condicaoResumo: c.condicaoResumo,
    sla: c.sla,
    commercial: c.commercial,
    modeloCobranca: c.modeloCobranca,
    penalidades: c.penalidades,
    status: c.status,
  });
}

export function computeSlaFitPct(args: {
  contratualGateInH: number;
  realCicloHoras: number | null | undefined;
  realDwellH: number | null | undefined;
  contratualDwellH: number;
}): number {
  const ciclo = args.realCicloHoras ?? args.contratualGateInH * 2;
  const dwell = args.realDwellH ?? args.contratualDwellH;
  const gateRatio = args.contratualGateInH > 0 ? ciclo / (args.contratualGateInH * 4) : 1;
  const dwellRatio = args.contratualDwellH > 0 ? dwell / args.contratualDwellH : 1;
  const raw = 100 - 40 * (gateRatio - 1) - 35 * Math.max(0, dwellRatio - 1);
  return Math.max(0, Math.min(100, Math.round(raw)));
}
