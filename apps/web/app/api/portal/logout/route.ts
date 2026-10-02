import { NextRequest, NextResponse } from "next/server";
import { forwardSetCookieHeaders } from "@/lib/forward-set-cookie";
import { getServerApiBase } from "@/lib/server-api-base";

export async function POST(req: NextRequest) {
  const base = getServerApiBase();
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/portal/logout`, {
      method: "POST",
      headers: {
        Cookie: req.headers.get("cookie") ?? "",
        Accept: "application/json",
        "X-RL-Portal-Cookie": "1",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
  const res = new NextResponse(null, { status: upstream.status });
  forwardSetCookieHeaders(upstream, res);
  return res;
}
