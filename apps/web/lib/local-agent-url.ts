/** PC do Gate nesta LAN (leitor + print-agent). */
const GATE_LAN_HOST = "192.168.250.150";
const remembered = new Map<number, string>();

function pageIsLoopback(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function addCandidate(list: string[], url?: string | null) {
  const n = url?.trim().replace(/\/$/, "");
  if (n && !list.includes(n)) list.push(n);
}

/** Ordem: env → último que funcionou → 127.0.0.1 (este PC) → host do Gate. */
export function localAgentCandidates(port: 39201 | 39202, envUrl?: string): string[] {
  const list: string[] = [];
  addCandidate(list, envUrl);
  addCandidate(list, remembered.get(port));
  if (typeof window !== "undefined") {
    try {
      addCandidate(list, sessionStorage.getItem(`rl.agent.${port}`));
    } catch {
      /* ignore */
    }
  }
  addCandidate(list, `http://127.0.0.1:${port}`);
  addCandidate(list, `http://localhost:${port}`);
  if (!pageIsLoopback()) addCandidate(list, `http://${GATE_LAN_HOST}:${port}`);
  return list;
}

export function rememberLocalAgent(port: 39201 | 39202, url: string) {
  remembered.set(port, url);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`rl.agent.${port}`, url);
  } catch {
    /* ignore */
  }
}

/** URL do agente neste PC. Prefere o endereço que já respondeu nesta sessão. */
export function localAgentUrl(port: 39201 | 39202, envUrl?: string): string {
  return localAgentCandidates(port, envUrl)[0] ?? `http://127.0.0.1:${port}`;
}

function addressSpaceForUrl(url: string): "loopback" | "local" {
  try {
    const h = new URL(url).hostname;
    if (h === "127.0.0.1" || h === "localhost") return "loopback";
  } catch {
    /* ignore */
  }
  return "local";
}

/** Chrome LNA: loopback para 127.0.0.1; local para outro IP da LAN. */
export function localAgentFetchInit(url: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    targetAddressSpace: addressSpaceForUrl(url),
  } as RequestInit;
}

/** Tenta 127.0.0.1 (este PC) e depois o IP do Gate até um agente responder. */
export async function fetchLocalAgent(
  port: 39201 | 39202,
  path: string,
  init?: RequestInit,
  envUrl?: string,
): Promise<Response> {
  const candidates = localAgentCandidates(port, envUrl);
  let lastErr: unknown;
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}${path}`, localAgentFetchInit(base, init));
      rememberLocalAgent(port, base);
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Nenhum agente local respondeu.");
}
