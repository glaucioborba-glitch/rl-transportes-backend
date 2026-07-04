import type { StaffUser } from "@/stores/staff-auth-store";

/** Perfis que enxergam badge e polling de cadastros pendentes. */
export function canPollPendenciasCadastro(user: StaffUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "GERENTE") return true;
  // Reservado para futuro papel FINANCEIRO dedicado.
  if (user.role === "FINANCEIRO") return true;
  return user.permissions?.includes("cadastro-financeiro:analisar") ?? false;
}
