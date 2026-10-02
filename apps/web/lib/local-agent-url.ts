/** PC do Gate nesta LAN (leitor + print-agent). Chrome bloqueia 127.0.0.1 a partir do IP do lab. */
const GATE_LAN_HOST = "192.168.250.150";

function pageIsLoopback(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/** URL do agente neste PC. No lab (192.168.x) usa o IP da LAN — não o loopback. */
export function localAgentUrl(port: 39201 | 39202, envUrl?: string): string {
  const fromEnv = envUrl?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (pageIsLoopback()) return `http://127.0.0.1:${port}`;
  return `http://${GATE_LAN_HOST}:${port}`;
}

/** Chrome LNA: loopback só quando o alvo é 127.0.0.1; na LAN o espaço é local. */
export function localAgentFetchInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    targetAddressSpace: pageIsLoopback() ? "loopback" : "local",
  } as RequestInit;
}
