import { NextRequest, NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/server-api-base";

/** Proxy server-side para `GET /auth/me` (sessão staff via cookies HttpOnly). */
export async function GET(req: NextRequest) {
  const base = getServerApiBase();
  const cookie = req.headers.get("cookie") ?? "";
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/auth/me`, {
      method: "GET",
      headers: {
        Cookie: cookie,
        Accept: "application/json",
        "X-RL-Auth-Cookie": "1",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }
  const text = await upstream.text();
  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
