import { localAgentFetchInit, localAgentUrl } from "@/lib/local-agent-url";

export const BIO_AGENT_URL = localAgentUrl(39201, process.env.NEXT_PUBLIC_BIO_AGENT_URL);

export type BioAgentHealth = {
  ok: boolean;
  error?: string;
  device?: string;
  usb?: boolean;
  com?: boolean;
};
export type BioAgentEnroll = { ok: boolean; fir?: string; error?: string };
export type BioAgentVerify = { ok: boolean; matched?: boolean; error?: string };

async function parseAgent<T>(res: Response): Promise<T & { error?: string; ok?: boolean }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T & { error?: string; ok?: boolean };
  } catch {
    throw new Error("Agente do leitor não respondeu. Rode npm run bio-agent neste PC.");
  }
}

function mensagemFalhaAgente(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (
    error instanceof TypeError ||
    /failed to fetch|networkerror|load failed|fetch failed/i.test(raw)
  ) {
    return "O navegador não alcançou o leitor. Neste PC do Gate, rode npm run bio-agent e recarregue a página.";
  }
  return raw || "Falha no leitor de digital.";
}

async function agentJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(
      `${localAgentUrl(39201, process.env.NEXT_PUBLIC_BIO_AGENT_URL)}${path}`,
      localAgentFetchInit({
        ...init,
        headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      }),
    );
  } catch (e) {
    throw new Error(mensagemFalhaAgente(e));
  }
  const body = await parseAgent<T>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || "Falha no leitor de digital.");
  }
  return body;
}

export async function probeBioAgent(): Promise<BioAgentHealth> {
  try {
    const res = await fetch(
      `${localAgentUrl(39201, process.env.NEXT_PUBLIC_BIO_AGENT_URL)}/health`,
      localAgentFetchInit({ headers: { Accept: "application/json" } }),
    );
    const body = await parseAgent<BioAgentHealth>(res);
    return {
      ok: Boolean(body.ok),
      usb: body.usb,
      com: body.com,
      device: body.device,
      error: body.error,
    };
  } catch (e) {
    return {
      ok: false,
      error: mensagemFalhaAgente(e),
    };
  }
}

export async function enrollBioAgent(): Promise<string> {
  const out = await agentJson<BioAgentEnroll>("/enroll", { method: "POST" });
  const fir = (out.fir ?? "").trim();
  if (fir.length < 32) {
    throw new Error("Cadastro da digital não gerou template. Tente de novo.");
  }
  return fir;
}

export async function verifyBioAgent(storedFir: string): Promise<boolean> {
  const out = await agentJson<BioAgentVerify>("/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storedFir }),
  });
  return Boolean(out.matched);
}
