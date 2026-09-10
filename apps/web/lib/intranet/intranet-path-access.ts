/** Regras de papel × URL da intranet (sem ícones — seguro para o Edge middleware). */

const SUPER = "SUPER_ADMIN";

type PathRule = { prefix: string; roles: string[] };

const RULES: PathRule[] = [
  { prefix: "/super-admin", roles: [SUPER] },
  { prefix: "/admin/chaos", roles: ["ADMIN", SUPER] },
  { prefix: "/admin/observability", roles: ["ADMIN", SUPER] },
  { prefix: "/admin/security", roles: ["ADMIN", SUPER] },
  { prefix: "/financeiro", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/rh", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/admin", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/cadastros/empresa", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/cadastros", roles: ["ADMIN", "GERENTE", "FINANCEIRO", "RH"] },
  { prefix: "/bi", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/ssma", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/grc", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/operador/gate", roles: ["ADMIN", "GERENTE", "OPERADOR_GATE"] },
  { prefix: "/operador/transportes", roles: ["ADMIN", "GERENTE", "OPERADOR_GATE"] },
  { prefix: "/operador/fretes", roles: ["ADMIN", "GERENTE", "OPERADOR_GATE"] },
  { prefix: "/operador/dispatch", roles: ["ADMIN", "GERENTE", "OPERADOR_GATE"] },
  { prefix: "/operador/patio", roles: ["ADMIN", "GERENTE", "OPERADOR_PATIO", "OPERADOR_GATE"] },
  { prefix: "/operador", roles: ["ADMIN", "GERENTE", "OPERADOR_PORTARIA", "OPERADOR_GATE", "OPERADOR_PATIO"] },
  { prefix: "/cockpit", roles: ["ADMIN", "GERENTE", "OPERADOR_PORTARIA", "OPERADOR_GATE", "OPERADOR_PATIO"] },
  { prefix: "/ai-console", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/digital-twin", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/sdt", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/aog", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/agi", roles: ["ADMIN", "GERENTE"] },
  { prefix: "/intranet", roles: ["ADMIN", "GERENTE", "OPERADOR_PORTARIA", "OPERADOR_GATE", "OPERADOR_PATIO"] },
];

export function intranetPathAllowed(role: string, pathname: string): boolean {
  if (role === SUPER) return true;
  const match = RULES.filter((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  if (!match) return true;
  return match.roles.includes(role);
}
