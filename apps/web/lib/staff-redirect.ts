/** Landing pós-login intranet por perfil operacional. */
export function defaultStaffHome(role: string | undefined | null): string {
  switch (role) {
    case "OPERADOR_PORTARIA":
      return "/operador/portaria";
    case "OPERADOR_GATE":
      return "/operador/gate/controle-entrada-saida";
    case "OPERADOR_PATIO":
      return "/operador/patio";
    case "ADMIN":
    case "GERENTE":
    case "SUPER_ADMIN":
      return "/operador/dashboard";
    default:
      return "/operador/dashboard";
  }
}

export function resolveStaffLoginDest(
  role: string | undefined | null,
  next: string | null | undefined,
): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return defaultStaffHome(role);
}
