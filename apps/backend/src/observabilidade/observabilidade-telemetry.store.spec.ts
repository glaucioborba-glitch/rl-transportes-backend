import { ObservabilidadeTelemetryStore } from './observabilidade-telemetry.store';

describe('ObservabilidadeTelemetryStore', () => {
  it('registra roundtrip e trace (in-memory dev)', async () => {
    const s = new ObservabilidadeTelemetryStore();
    s.registrarHttpRoundtrip({
      requestId: 'rid-1',
      path: '/solicitacoes',
      method: 'GET',
      statusCode: 200,
      durationMs: 42,
    });
    const g = await s.getContadoresGlobais();
    expect(g.totalReq).toBe(1);
    expect(g.sucesso2xx).toBe(1);
    const t = await s.getTrace('rid-1');
    expect(t?.spans.length).toBeGreaterThan(0);
    expect(t?.fluxoResumo).toBeTruthy();
    expect(s.isRedisBackendActive()).toBe(false);
  });
});
