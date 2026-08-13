/** Módulos de demonstração (localStorage) — desligados em produção por padrão. */

export const DEMO_MODULE_PREFIXES = [
  '/rh',
  '/ssma',
  '/grc',
  '/digital-twin',
  '/ai-console',
  '/agi',
  '/aog',
  '/sdt',
] as const;

export function isDemoModulesEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODULES === '1') return true;
  if (process.env.NEXT_PUBLIC_DEMO_MODULES === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

export function isDemoModulePath(pathname: string): boolean {
  return DEMO_MODULE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function demoModulesBlockedRedirect(pathname: string): string | null {
  if (!isDemoModulePath(pathname)) return null;
  if (isDemoModulesEnabled()) return null;
  return '/operador/dashboard';
}
