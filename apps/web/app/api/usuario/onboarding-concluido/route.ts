import { NextRequest, NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/server-api-base";

/** Marca product tour concluído — proxy para POST /portal/usuario/onboarding-concluido. */
export async function POST(req: NextRequest) {
  const base = getServerApiBase();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-RL-Portal-Cookie": "1",
  };
  const cookie = req.headers.get("cookie");
  if (cookie) headers.Cookie = cookie;
  const auth = req.headers.get("authorization");
  if (auth) headers.Authorization = auth;

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/portal/usuario/onboarding-concluido`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ message: "Backend indisponível" }, { status: 502 });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
