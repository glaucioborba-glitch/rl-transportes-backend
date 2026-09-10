import { NextRequest, NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/server-api-base";
import { consumeIpRateLimit } from "@/lib/api/simple-ip-rate-limit";

/** Proxy ViaCEP + IBGE via Nest (`GET /address/cep/:cep`) — evita CORS no browser. */
export async function GET(req: NextRequest, ctx: { params: { cep: string } }) {
  if (!consumeIpRateLimit(req, "cep", 40)) {
    return NextResponse.json(
      { field: "endereco", message: "Muitas consultas de CEP. Tente novamente em instantes." },
      { status: 429 },
    );
  }
  const raw = (ctx.params.cep ?? "").replace(/\D/g, "");
  if (raw.length !== 8) {
    return NextResponse.json(
      { field: "endereco", message: "CEP deve ter 8 dígitos." },
      { status: 400 },
    );
  }

  const base = getServerApiBase();
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/address/cep/${raw}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json(
      { field: "endereco", message: "Serviço de CEP indisponível no momento." },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
