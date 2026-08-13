import {
  buildFallbackPayload,
  portalDashboardFallbackPayload,
} from './resilience-fallback.registry';

describe('resilience-fallback.registry', () => {
  it('dashboard fallback inclui kpisCx e slasCx', () => {
    const payload = portalDashboardFallbackPayload('tenant-x');
    expect(payload.kpisCx.valores.faturamento_aberto).toBe(0);
    expect(payload.slasCx.tenantId).toBe('tenant-x');
    expect(payload.recent.items).toEqual([]);
  });

  it('buildFallbackPayload portal dashboard', () => {
    const payload = buildFallbackPayload('portal', '/cliente/portal/dashboard') as {
      kpisCx: { valores: { faturamento_aberto: number } };
    };
    expect(payload.kpisCx.valores.faturamento_aberto).toBe(0);
  });
});
