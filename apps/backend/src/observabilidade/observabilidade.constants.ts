/** TTLs da telemetria persistida em Redis (ObservabilidadeTelemetryStore). */
export const OBS_TELEMETRY_LOGS = 'obs:v1:telemetry:logs';
export const OBS_TELEMETRY_BUCKETS = 'obs:v1:telemetry:buckets';
export const OBS_TELEMETRY_COUNTERS = 'obs:v1:telemetry:counters';
export const OBS_TELEMETRY_TRACES = 'obs:v1:telemetry:traces';
export const OBS_TELEMETRY_TRACE_ORDER = 'obs:v1:telemetry:trace:order';

export const TTL_TELEMETRY_LOGS_SEC = 86_400;
export const TTL_TELEMETRY_METRICS_SEC = 604_800;
export const TTL_TELEMETRY_TRACES_SEC = 3_600;

export const MAX_TELEMETRY_LOGS = 4_000;
export const MAX_TELEMETRY_TRACES = 800;
