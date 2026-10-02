import { NextRequest, NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/server-api-base";

/** Proxy BFF: GET /api/dashboard/kpis → backend /dashboard/kpis (JWT staff via cookie). */
export async function GET(req: NextRequest) {
  const base = getServerApiBase();
  const cookie = req.headers.get("cookie") ?? "";
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/dashboard/kpis`, {
      method: "GET",
      headers: {
        Cookie: cookie,
        Accept: "application/json",
        "X-RL-Auth-Cookie": "1",
      },
      signal: AbortSignal.timeout(15_000),
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
