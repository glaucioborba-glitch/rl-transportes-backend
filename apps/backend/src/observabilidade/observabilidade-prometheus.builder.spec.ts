import { buildPrometheusText } from './observabilidade-prometheus.builder';

describe('observabilidade-prometheus.builder', () => {
  it('gera texto Prometheus com buckets', () => {
    const text = buildPrometheusText({
      buckets: [
        {
          rotaNormalizada: '/test',
          latenciaMsSum: 100,
          contagem: 2,
          status: { 200: 2 },
        },
      ],
      uptimeSec: 10,
      rssBytes: 1000,
      heapUsedBytes: 500,
      dbPingMs: 3,
      redisPingMs: 1,
      webhookQueueDepth: 0,
    });
    expect(text).toContain('rl_http_requests_total{route="/test",status="200"} 2');
    expect(text).toContain('rl_process_uptime_seconds 10');
    expect(text).toContain('rl_db_ping_ms 3');
  });
});
