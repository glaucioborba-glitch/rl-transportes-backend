/** Evento global para banner circuit breaker (sem logs repetidos no console). */
export const RL_CIRCUIT_EVENT = "rl-circuit-open";

let lastEmitAt = 0;

/** Debounce leve para evitar rajadas quando várias rotas abrem circuito ao mesmo tempo. */
export function emitCircuitOpenBanner(retryAfterMs: number): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastEmitAt < 1500) return;
  lastEmitAt = now;
  window.dispatchEvent(
    new CustomEvent(RL_CIRCUIT_EVENT, {
      detail: { retryAfterMs: Math.max(500, retryAfterMs) },
    }),
  );
}

/** Corpo `{ status: \"circuit-open\", retryAfter, data }` → devolve `data` e dispara o banner. */
export function maybeUnwrapCircuitJson<T>(raw: Record<string, unknown>): T {
  if (raw.status === "circuit-open") {
    emitCircuitOpenBanner(Number(raw.retryAfter) || 30_000);
    return (raw.data ?? {}) as T;
  }
  return raw as unknown as T;
}
