export type ThemeMode = "dark" | "light";

/**
 * A home institucional (`/`) permanece no visual original.
 * Claro/escuro vale a partir das telas de login e do restante do app.
 */
export function isMarketingHomePath(pathname: string | null | undefined): boolean {
  if (pathname == null || pathname === "") return true;
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return path === "/";
}

export function resolveAppliedTheme(
  pathname: string | null | undefined,
  storedMode: ThemeMode,
): ThemeMode {
  return isMarketingHomePath(pathname) ? "dark" : storedMode;
}
