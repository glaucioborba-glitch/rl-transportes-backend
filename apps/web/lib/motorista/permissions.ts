import type { MotoristaUser } from "@/stores/motorista-auth-store";

export function canAccessDashboard(user: MotoristaUser | null): boolean {
  return Boolean(user?.permissions?.includes("dashboard:operacional"));
}

export function canCreateSolicitacao(user: MotoristaUser | null): boolean {
  return Boolean(user?.permissions?.includes("solicitacoes:criar"));
}

export function canPortaria(user: MotoristaUser | null): boolean {
  return Boolean(user?.permissions?.includes("solicitacoes:portaria"));
}

export function canListClientes(user: MotoristaUser | null): boolean {
  return Boolean(user?.permissions?.includes("clientes:ler"));
}
