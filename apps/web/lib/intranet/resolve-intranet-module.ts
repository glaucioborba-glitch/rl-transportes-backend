import type { IntranetModuleId } from "./intranet-nav-config";

/** Resolve o módulo ativo a partir do pathname (ordem importa). */
export function resolveIntranetModule(pathname: string): IntranetModuleId {
  if (pathname.startsWith("/operador/gate")) return "gate";
  if (pathname.startsWith("/cadastros")) return "cadastros";
  if (pathname.startsWith("/operador/dispatch")) return "dispatch";
  if (pathname.startsWith("/operador/patio")) return "patio";
  if (pathname.startsWith("/operador/dashboard") || pathname === "/operador") return "dashboard";
  if (pathname.startsWith("/financeiro")) return "financeiro";
  if (pathname.startsWith("/rh")) return "rh";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/cockpit")) return "cockpit";
  if (pathname.startsWith("/bi")) return "bi";
  if (pathname.startsWith("/grc")) return "grc";
  if (pathname.startsWith("/ssma")) return "ssma";
  if (
    pathname.startsWith("/agi") ||
    pathname.startsWith("/aog") ||
    pathname.startsWith("/sdt") ||
    pathname.startsWith("/ai-console") ||
    pathname.startsWith("/digital-twin")
  ) {
    return "admin";
  }
  if (pathname.startsWith("/intranet")) return "gate";
  return "dashboard";
}

export function isIntranetDesktopPath(pathname: string): boolean {
  const prefixes = [
    "/operador/dashboard",
    "/operador/dispatch",
    "/operador/gate",
    "/operador/patio",
    "/cadastros",
    "/financeiro",
    "/rh",
    "/admin",
    "/cockpit",
    "/bi",
    "/grc",
    "/ssma",
    "/intranet",
    "/agi",
    "/aog",
    "/sdt",
    "/ai-console",
    "/digital-twin",
  ];
  if (pathname === "/operador" || pathname.startsWith("/operador/")) {
    if (pathname.startsWith("/operador/portaria")) return false;
    if (pathname.startsWith("/operador/login")) return false;
  }
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
