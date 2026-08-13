export type ParsedQrCredencialPayload = {
  protocolo: string;
  container?: string;
  versao?: number;
};

/** Interpreta JSON bruto lido pelo scanner do QR da credencial. */
export function parseQrCredencialPayload(raw: string): ParsedQrCredencialPayload | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const protocolo = String(parsed.protocolo ?? '').trim();
    if (!protocolo) return null;

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
    }

    return { protocolo, container, versao };
  } catch {
    return null;
  }
}
