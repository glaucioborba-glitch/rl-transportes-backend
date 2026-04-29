import type { HttpMetricBucket } from './observabilidade.types';

/** Export Prometheus text (0.0.4) a partir de buckets agregados em memória. */
export function buildPrometheusText(input: {
  buckets: HttpMetricBucket[];
  uptimeSec: number;
  rssBytes: number;
  heapUsedBytes: number;
  dbPingMs?: number | null;
  redisPingMs?: number | null;
  /** Proxy opcional via env */
  webhookQueueDepth?: number | null;
}): string {
  const lines: string[] = [];
  lines.push('# HELP rl_http_request_duration_ms_sum Soma latências HTTP por rota normalizada');
  lines.push('# TYPE rl_http_request_duration_ms_sum counter');
  lines.push('# HELP rl_http_request_latency_avg_ms Latência média por rota (ms)');
  lines.push('# TYPE rl_http_request_latency_avg_ms gauge');
  lines.push('# HELP rl_http_requests_total Total de requisições por rota e status');
  lines.push('# TYPE rl_http_requests_total counter');

  for (const b of input.buckets) {
    const avg = b.contagem > 0 ? b.latenciaMsSum / b.contagem : 0;
    const route = escapeLabel(b.rotaNormalizada);
    lines.push(`rl_http_request_duration_ms_sum{route="${route}"} ${b.latenciaMsSum}`);
    lines.push(`rl_http_request_latency_avg_ms{route="${route}"} ${avg.toFixed(4)}`);
    lines.push(`rl_http_request_count{route="${route}"} ${b.contagem}`);
    for (const [st, c] of Object.entries(b.status)) {
      lines.push(`rl_http_requests_total{route="${route}",status="${st}"} ${c}`);
    }
  }

  lines.push('# HELP rl_process_uptime_seconds Tempo de execução do processo Node');
  lines.push('# TYPE rl_process_uptime_seconds gauge');
  lines.push(`rl_process_uptime_seconds ${input.uptimeSec}`);

  lines.push('# HELP rl_process_memory_rss_bytes Resident set size');
  lines.push('# TYPE rl_process_memory_rss_bytes gauge');
  lines.push(`rl_process_memory_rss_bytes ${input.rssBytes}`);

  lines.push('# HELP rl_process_heap_used_bytes Heap V8 usado');
  lines.push('# TYPE rl_process_heap_used_bytes gauge');
  lines.push(`rl_process_heap_used_bytes ${input.heapUsedBytes}`);

  if (input.dbPingMs != null) {
    lines.push('# HELP rl_db_ping_ms Latência SELECT 1');
    lines.push('# TYPE rl_db_ping_ms gauge');
    lines.push(`rl_db_ping_ms ${input.dbPingMs}`);
  }
  if (input.redisPingMs != null) {
    lines.push('# HELP rl_redis_ping_ms Latência PING Redis');
    lines.push('# TYPE rl_redis_ping_ms gauge');
    lines.push(`rl_redis_ping_ms ${input.redisPingMs}`);
  }
  if (input.webhookQueueDepth != null) {
    lines.push('# HELP rl_webhook_queue_depth_proxy Profundidade proxy fila webhooks (env)');
    lines.push('# TYPE rl_webhook_queue_depth_proxy gauge');
    lines.push(`rl_webhook_queue_depth_proxy ${input.webhookQueueDepth}`);
  }

  return lines.join('\n') + '\n';
}

function escapeLabel(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}
