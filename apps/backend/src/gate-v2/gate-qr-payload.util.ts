export type ParsedQrCredencialPayload = {
  protocolo: string;
  token?: string;
  container?: string;
  versao?: number;
};

function tryParseObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeBase64Utf8(raw: string): string | null {
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    return decoded.startsWith('{') ? decoded : null;
  } catch {
    return null;
  }
}

/** Interpreta JSON unificado `{ protocolo, token }` e payloads antigos (JSON ou base64). */
export function parseQrCredencialPayload(raw: string): ParsedQrCredencialPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed = tryParseObject(trimmed);
  if (!parsed && !trimmed.startsWith('{')) {
    const decoded = decodeBase64Utf8(trimmed);
    parsed = decoded ? tryParseObject(decoded) : null;
  }
  if (!parsed) return null;

  const protocolo = String(parsed.protocolo ?? '').trim();
  if (!protocolo) return null;

  const tokenRaw = parsed.token ?? parsed.qrToken;
  const token = tokenRaw != null && String(tokenRaw).trim() ? String(tokenRaw).trim() : undefined;

  const versaoRaw = parsed.versao ?? parsed.versaoCredencial;
  let versao: number | undefined;
  if (versaoRaw !== undefined && versaoRaw !== null && versaoRaw !== '') {
    const n = Number(versaoRaw);
    versao = Number.isFinite(n) ? n : undefined;
  }

  let container: string | undefined;
  if (Array.isArray(parsed.containers) && parsed.containers.length) {
    container = String(parsed.containers[0] ?? '').trim() || undefined;
  } else if (parsed.container != null && String(parsed.container).trim()) {
    container = String(parsed.container).trim();
  } else if (parsed.containerNumero != null && String(parsed.containerNumero).trim()) {
    container = String(parsed.containerNumero).trim();
  }

  return { protocolo, token, container, versao };
}
