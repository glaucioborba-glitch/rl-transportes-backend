import { localAgentFetchInit, localAgentUrl } from "@/lib/local-agent-url";

export const PRINT_AGENT_URL = localAgentUrl(39202, process.env.NEXT_PUBLIC_PRINT_AGENT_URL);
export const PRINT_AGENT_PRINTER_KEY = "rl.print-agent.printer";

export type PrintAgentPrinter = { name: string; default?: boolean; virtual?: boolean };
export type PrintAgentHealth = {
  ok: boolean;
  sumatra?: boolean;
  printers: PrintAgentPrinter[];
  error?: string;
};

const MSG_AGENTE_FORA =
  "O navegador não alcançou o agente de impressão. Neste PC da impressora, rode npm run print-agent e tente de novo.";

function mensagemFalhaAgente(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError" || /aborted|timeout/i.test(raw)) {
    return "A impressora demorou para responder. Se o cupom saiu, está tudo certo.";
  }
  if (
    error instanceof TypeError ||
    /failed to fetch|networkerror|load failed|fetch failed/i.test(raw)
  ) {
    return MSG_AGENTE_FORA;
  }
  return raw || "Falha no agente de impressão.";
}

async function parseAgent<T>(res: Response): Promise<T & { error?: string; ok?: boolean }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T & { error?: string; ok?: boolean };
  } catch {
    throw new Error("Agente de impressão não respondeu. Rode npm run print-agent neste PC.");
  }
}

function asPrinterList(raw: unknown): PrintAgentPrinter[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .map((item) => {
      if (typeof item === "string") return { name: item };
      if (item && typeof item === "object" && "name" in item) {
        const row = item as Record<string, unknown>;
        return {
          name: String(row.name ?? row.Name ?? ""),
          default: Boolean(row.default ?? row.Default),
          virtual: Boolean(row.virtual ?? row.Virtual),
        };
      }
      return { name: "" };
    })
    .filter((p) => p.name.trim().length > 0);
}

export function preferirImpressora(printers: PrintAgentPrinter[], saved?: string | null): string {
  const fisicas = printers.filter((p) => !p.virtual);
  const names = fisicas.map((p) => p.name);
  if (saved && names.includes(saved)) return saved;
  const termica = fisicas.find((p) =>
    /tm-t20|epson.*tm|térmica|termica|thermal/i.test(p.name),
  );
  if (termica) return termica.name;
  const padrao = fisicas.find((p) => p.default);
  return padrao?.name || names[0] || "";
}

export async function probePrintAgent(): Promise<PrintAgentHealth> {
  try {
    const res = await fetch(
      `${localAgentUrl(39202, process.env.NEXT_PUBLIC_PRINT_AGENT_URL)}/health`,
      localAgentFetchInit({ headers: { Accept: "application/json" } }),
    );
    const body = await parseAgent<PrintAgentHealth>(res);
    const printers = asPrinterList(body.printers);
    return {
      ok: Boolean(body.ok),
      sumatra: Boolean(body.sumatra),
      printers,
      error: body.error,
    };
  } catch (e) {
    return { ok: false, printers: [], error: mensagemFalhaAgente(e) };
  }
}

export async function printViaAgent(blob: Blob, printer?: string): Promise<void> {
  const qs = printer ? `?printer=${encodeURIComponent(printer)}` : "";
  let res: Response;
  try {
    res = await fetch(`${localAgentUrl(39202, process.env.NEXT_PUBLIC_PRINT_AGENT_URL)}/print${qs}`, localAgentFetchInit({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": blob.type || "application/pdf",
      },
      body: blob,
      signal: AbortSignal.timeout(25_000),
    }));
  } catch (e) {
    throw new Error(mensagemFalhaAgente(e));
  }
  const body = await parseAgent<{ ok?: boolean; error?: string }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || "A impressora não aceitou o documento.");
  }
  if (printer) {
    try {
      localStorage.setItem(PRINT_AGENT_PRINTER_KEY, printer);
    } catch {
      /* ignore */
    }
  }
}
