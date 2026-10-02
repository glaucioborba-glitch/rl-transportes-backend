/** Remove segredos e mascara documentos para persistência em auditoria portal. */

const FORBIDDEN_KEYS = new Set([
  'password',
  'senha',
  'novaSenha',
  'nova_senha',
  'refreshToken',
  'refresh_token',
  'accessToken',
  'access_token',
  'token',
  'authorization',
  'cookie',
  'set-cookie',
]);

export function maskCpfCnpj(raw: string): string {
  const d = String(raw).replace(/\D/g, '');
  if (d.length < 4) return '****';
  return `***${d.slice(-4)}`;
}

export function sanitizePortalAuditPayload(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    const t = input.trim();
    if (/^\d{11,14}$/.test(t.replace(/\D/g, ''))) return maskCpfCnpj(t);
    return input.length > 2000 ? `${input.slice(0, 2000)}…` : input;
  }
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 50).map((x) => sanitizePortalAuditPayload(x));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (FORBIDDEN_KEYS.has(lk)) continue;
    if (lk.includes('password') || lk.includes('senha') || lk.includes('token')) continue;
    if (lk === 'documento' || lk === 'cpfcnpj' || lk === 'cpf_cnpj') {
      out[k] = typeof v === 'string' ? maskCpfCnpj(v) : sanitizePortalAuditPayload(v);
      continue;
    }
    out[k] = sanitizePortalAuditPayload(v);
  }
  return out;
}

export function summarizeAuditResult(body: unknown, maxChars = 4000): unknown {
  try {
    const s = JSON.stringify(body);
    if (s.length <= maxChars) return sanitizePortalAuditPayload(body);
    return { truncated: true, length: s.length, preview: `${s.slice(0, 512)}…` };
  } catch {
    return { nonSerializable: true };
  }
}
