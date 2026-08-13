/** Intervalos de polling do Gate — mais espaçados em dev para reduzir re-renders no Fast Refresh. */
export const GATE_POLLING_INTERVAL_MS =
  process.env.NODE_ENV === "production" ? 15_000 : 60_000;

/** WebSocket do pátio só em produção; em dev usa apenas polling manual/espaçado. */
export const GATE_WEBSOCKET_ENABLED = process.env.NODE_ENV === "production";

export function gateRefreshSubtitle(): string {
  if (process.env.NODE_ENV === "production") {
    return "Visão operacional do Gate · atualização automática (WebSocket pátio + polling 15s)";
  }
  return "Visão operacional do Gate · dev: polling 60s (WebSocket desativado)";
}
