import { NextRequest, NextResponse } from "next/server";
import { forwardSetCookieHeaders } from "@/lib/forward-set-cookie";
import { getServerApiBase } from "@/lib/server-api-base";

const DEVICE_HEADERS = [
  "x-device-fingerprint",
  "x-device-os",
  "x-device-browser",
  "x-device-timezone",
  "x-device-screen",
] as const;

export async function POST(req: NextRequest) {
  const base = getServerApiBase();
  const body = await req.text();
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") || "application/json",
  };
  const rlCookie = req.headers.get("x-rl-auth-cookie");
  if (rlCookie) headers["X-RL-Auth-Cookie"] = rlCookie;
  const cookie = req.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;
  for (const name of DEVICE_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers[name] = v;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/auth/refresh`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return NextResponse.json({ message: "API indisponível (refresh proxy)." }, { status: 502 });
  }

  const text = await upstream.text();
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  });
  forwardSetCookieHeaders(upstream, res);
  return res;
}
