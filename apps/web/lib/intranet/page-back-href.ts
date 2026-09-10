/** Hubs do módulo: sem botão Voltar. */
const INTRANET_HUBS = new Set([
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
  "/operador/dashboard",
  "/operador",
]);

/** Destino quando o nível acima no path não tem página. */
const BACK_HREF_OVERRIDES: Array<[RegExp, string]> = [
  [/^\/financeiro\/areceber\/boletos\/[^/]+$/, "/financeiro/areceber"],
  [/^\/admin\/config\/regua-cobranca$/, "/admin"],
];

export function normalizeIntranetPath(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/** `null` = não mostrar Voltar (hub do módulo). */
export function resolvePageBackHref(pathname: string): string | null {
  const path = normalizeIntranetPath(pathname);
  if (INTRANET_HUBS.has(path)) return null;
  for (const [re, href] of BACK_HREF_OVERRIDES) {
    if (re.test(path)) return href;
  }
  const parent = path.replace(/\/[^/]+$/, "");
  return parent || "/";
}
