import { RESILIENCE_ROUTE_RULES } from './resilience.constants';

export function matchResilienceRule(path: string):
  | (typeof RESILIENCE_ROUTE_RULES)[number]
  | null {
  const p = (path.split('?')[0] || '/').trim();
  for (const r of RESILIENCE_ROUTE_RULES) {
    if (p === r.prefix || p.startsWith(`${r.prefix}/`)) {
      return r;
    }
  }
  return null;
}

export function shouldBypassResilience(path: string): boolean {
  const p = path.split('?')[0] || '/';
  if (p.startsWith('/health')) return true;
  if (p.startsWith('/docs')) return true;
  if (p.startsWith('/favicon')) return true;
  if (p.startsWith('/admin/observability')) return true;
  if (p.startsWith('/admin/chaos')) return true;
  if (p.startsWith('/auth')) return true;
  if (p.startsWith('/portal/login') || p.startsWith('/portal/cadastrar')) return true;
  return false;
}
