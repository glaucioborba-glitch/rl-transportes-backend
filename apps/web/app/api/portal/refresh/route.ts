import { NextRequest, NextResponse } from "next/server";
import { forwardSetCookieHeaders } from "@/lib/forward-set-cookie";
import { getServerApiBase } from "@/lib/server-api-base";

const TIMEOUT_MS = 25_000;

export async function POST(req: NextRequest) {
  const base = getServerApiBase();
  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/portal/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": req.headers.get("content-type") || "application/json",
        Cookie: req.headers.get("cookie") ?? "",
        Accept: "application/json",
        "X-RL-Portal-Cookie": "1",
      },
      body: body || "{}",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json({ message: "API indisponível" }, { status: 502 });
  }
  const text = await upstream.text();
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
  forwardSetCookieHeaders(upstream, res);
  return res;
}
