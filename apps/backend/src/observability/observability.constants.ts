/** Prefixos Redis — v1 isolado para não colidir com sessões/cache. */
export const OBS_LATENCY_LIST = 'obs:v1:latency:list';
export const OBS_ROUTE_RANK_Z = 'obs:v1:route:rank';
export const OBS_USER_RANK_Z = 'obs:v1:user:rank';
export const OBS_ERRORS_LIST = 'obs:v1:errors:list';
export const OBS_HEALTH_SNAPSHOT = 'obs:v1:health:snapshot';
export const OBS_THROUGHPUT_MIN_PREFIX = 'obs:v1:throughput:min:';
export const OBS_FAIL_HEAT_PREFIX = 'obs:v1:failheat:h:';
export const OBS_LIVE_LOGS = 'obs:v1:live:logs';
export const OBS_WS_CHANNEL = 'obs:ws:events';

export const TTL_METRICS_SEC = 600;
export const TTL_ERRORS_SEC = 3600;
export const TTL_HEALTH_SNAPSHOT_SEC = 60;
