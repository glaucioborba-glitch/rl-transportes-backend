const KEY = "rl_motorista_pins_v1";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveMap(m: Record<string, string>) {
  localStorage.setItem(KEY, JSON.stringify(m));
}

function randomPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** PIN estável por solicitação (somente front; backend não valida). */
export function getOrCreatePin(solicitacaoId: string): string {
  const m = readMap();
  if (m[solicitacaoId]) return m[solicitacaoId];
  const pin = randomPin();
  m[solicitacaoId] = pin;
  saveMap(m);
  return pin;
}

export function qrPayloadFromTrip(input: { solicitacaoId: string; protocolo: string; pin: string }) {
  return JSON.stringify({
    v: 1,
    sid: input.solicitacaoId,
    p: input.protocolo,
    pin: input.pin,
  });
}
