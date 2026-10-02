import { NextRequest, NextResponse } from "next/server";
import { forwardSetCookieHeaders } from "@/lib/forward-set-cookie";
import { getServerApiBase } from "@/lib/server-api-base";

const TIMEOUT_MS = 30_000;

type CheckinBody = {
  status?: string;
  timestamp?: string;
  placa?: string;
  motoristaNome?: string;
  fotos?: {
    caminhao?: string;
    container?: string;
    documento?: string;
  };
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ solicitacaoId: string }> },
) {
  const { solicitacaoId } = await ctx.params;
  const base = getServerApiBase();
  let body: CheckinBody;
  try {
    body = (await req.json()) as CheckinBody;
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const placa = body.placa?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!placa || placa.length < 7) {
    return NextResponse.json({ message: "Placa inválida" }, { status: 400 });
  }

  const upstreamBody = {
    solicitacaoId,
    placa,
    motoristaNome: body.motoristaNome,
    timestamp: body.timestamp ?? new Date().toISOString(),
    fotosCaminhao: body.fotos?.caminhao ? [body.fotos.caminhao] : [],
    fotosContainer: body.fotos?.container ? [body.fotos.container] : [],
    fotosDocumento: body.fotos?.documento ? [body.fotos.documento] : [],
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-RL-Auth-Cookie": "1",
  };
  const cookie = req.headers.get("cookie");
  if (cookie) headers.Cookie = cookie;

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/solicitacoes/portaria`, {
      method: "POST",
      headers,
      body: JSON.stringify(upstreamBody),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json(
      { message: `API indisponível (proxy → ${base})` },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  const res = new NextResponse(text || "{}", {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  });
  forwardSetCookieHeaders(upstream, res);
  return res;
}
