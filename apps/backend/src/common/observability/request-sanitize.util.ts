const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
  'cpf',
  'cnpj',
  'cpfcnpj',
]);

export function sanitizeRequestPayload(payload: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (payload == null || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.slice(0, 20).map((item) => sanitizeRequestPayload(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else {
      out[key] = sanitizeRequestPayload(value, depth + 1);
    }
  }
  return out;
}
