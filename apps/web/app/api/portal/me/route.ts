import { NextRequest, NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/server-api-base";

export async function GET(req: NextRequest) {
  const base = getServerApiBase();
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/portal/me`, {
      method: "GET",
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
  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }
  const text = await upstream.text();
  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
