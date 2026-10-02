/** Módulos de demonstração — só ligam com NEXT_PUBLIC_DEMO_MODULES=1. */

export const DEMO_MODULE_PREFIXES = [
  '/ssma',
  '/grc',
  '/digital-twin',
  '/ai-console',
  '/agi',
  '/aog',
  '/sdt',
] as const;

/** Fora do ar neste momento — independente do flag de demo. */
export const HIDDEN_MODULE_PREFIXES = ['/bi'] as const;

export function isDemoModulesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODULES === '1';
}

export function isDemoModulePath(pathname: string): boolean {
  return DEMO_MODULE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isHiddenModulePath(pathname: string): boolean {
  return HIDDEN_MODULE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function demoModulesBlockedRedirect(pathname: string): string | null {
  if (isHiddenModulePath(pathname)) return '/operador/dashboard';
  if (!isDemoModulePath(pathname)) return null;
  if (isDemoModulesEnabled()) return null;
  return '/operador/dashboard';
}
