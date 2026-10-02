/** Serviço lógico para dashboards (sem acoplamento a módulos Nest). */
export function inferServiceFromRoute(path: string): string {
  const p = path || '';
  if (p.includes('/portal') || p.includes('/cx-portais')) return 'portal';
  if (p.includes('/mobile')) return 'mobile-hub';
  if (p.includes('/admin/security') || p.includes('/security-center')) return 'security-center';
  if (p.includes('/motorista')) return 'motorista';
  if (p.includes('/operador')) return 'operador';
  if (p.includes('/auth')) return 'auth';
  if (p.includes('/health')) return 'health';
  return 'api';
}
