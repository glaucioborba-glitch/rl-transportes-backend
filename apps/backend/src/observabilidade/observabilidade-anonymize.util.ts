import type { LogOrigem } from './observabilidade.types';

/** Remove dados sensíveis de snapshots para logs (Authorization, tokens em texto). */
export function anonymizeAuthorization(value: string | undefined): string | undefined {
  if (!value) return value;
  if (/^Bearer\s+/i.test(value)) return 'Bearer [REDACTED]';
  return '[REDACTED]';
}

/** Mascara email para exibição correlacionada (LGPD-friendly). */
export function maskEmail(email: string | undefined): string | undefined {
  if (!email || !email.includes('@')) return email;
  const [u, d] = email.split('@');
  const um = u.length <= 2 ? '*' : `${u[0]}***${u[u.length - 1]}`;
  return `${um}@${d}`;
}

/** Classifica rota HTTP em domínio de origem para telemetria. */
export function classificarOrigemPorRota(path: string): LogOrigem {
  const p = path.split('?')[0].toLowerCase();
  if (p.startsWith('/auth')) return 'auth';
  if (p.startsWith('/mobile')) return 'mobile';
  if (
    p.startsWith('/solicitacoes') ||
    p.startsWith('/dashboard') ||
    p.includes('/portaria') ||
    p.includes('/gate') ||
    p.includes('/patio') ||
    p.includes('/saida')
  )
    return 'operacional';
  if (
    p.startsWith('/faturamento') ||
    p.startsWith('/nfse') ||
    p.startsWith('/grc') ||
    p.startsWith('/fiscal')
  )
    return 'fiscal';
  if (
    p.startsWith('/financeiro') ||
    p.startsWith('/tesouraria') ||
    p.startsWith('/integracao/pagamentos')
  )
    return 'financeiro';
  if (p.startsWith('/ia-operacional') || p.startsWith('/ia')) return 'ia';
  if (p.startsWith('/simulador')) return 'simulador';
  if (p.startsWith('/rh') || p.startsWith('/folha')) return 'rh';
  if (p.startsWith('/integracao') || p.startsWith('/cliente-api') || p.startsWith('/api/v1'))
    return 'integracao';
  if (p.startsWith('/observabilidade')) return 'observabilidade';
  return 'outros';
}

/** Normaliza path para agregação de métricas (remove IDs UUID). */
export function normalizarRotaMetricas(path: string): string {
  let s = path.split('?')[0];
  s = s.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id',
  );
  s = s.replace(/\b\d{10,14}\b/g, ':num');
  return s || '/';
}
