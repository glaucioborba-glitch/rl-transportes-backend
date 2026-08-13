import { NextRequest, NextResponse } from "next/server";

const BRASILAPI_CNPJ_URL = "https://brasilapi.com.br/api/cnpj/v1";
const UPSTREAM_TIMEOUT_MS = 8000;

/** Proxy BrasilAPI CNPJ — evita bloqueio Cloudflare/CORS no browser. */
export async function GET(_req: NextRequest, ctx: { params: { cnpj: string } }) {
  const digits = (ctx.params.cnpj ?? "").replace(/\D/g, "");
  if (digits.length !== 14) {
    return NextResponse.json({ message: "CNPJ deve ter 14 dígitos." }, { status: 400 });
  }

  /** Pré-aquecimento da rota no cadastro — não consulta a BrasilAPI. */
  if (digits === "00000000000000") {
    return new NextResponse(null, { status: 204 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BRASILAPI_CNPJ_URL}/${digits}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "RL-Transportes/1.0 (+portal-cadastro)",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json(
      { message: "Serviço de consulta CNPJ indisponível no momento." },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
