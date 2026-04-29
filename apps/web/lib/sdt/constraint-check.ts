import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";

/** Verifica se ação simulada viola limites heurísticos (sem persistência). */
export function checkOperationalConstraints(
  snap: OperationalSnapshot,
  iaProb: number,
  actionLabel: string,
): { allowed: boolean; reason: string } {
  const lower = actionLabel.toLowerCase();
  if (snap.sat >= 96 && lower.includes("in-flow") && !lower.includes("limit")) {
    return { allowed: false, reason: "AÇÃO PROIBIDA: saturação limite — não aumentar entrada sem despressurização." };
  }
  if (iaProb > 0.7 && lower.includes("reduz") && lower.includes("gate-out")) {
    return { allowed: false, reason: "AÇÃO PROIBIDA: risco IA >70% — não reduzir saída." };
  }
  if (snap.vb > 0 && lower.includes("ignorar") && (lower.includes("nc") || lower.includes("não conformidade"))) {
    return { allowed: false, reason: "AÇÃO PROIBIDA: violações operacionais ativas devem ser corrigidas primeiro." };
  }
  return { allowed: true, reason: "Dentro dos limites da simulação autônoma." };
}
