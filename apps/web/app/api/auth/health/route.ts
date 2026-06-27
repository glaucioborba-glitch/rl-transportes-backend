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

export async function GET(req: NextRequest) {
  const base = getServerApiBase();
  const headers: Record<string, string> = {};
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
    upstream = await fetch(`${base}/auth/health`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return NextResponse.json({ message: "API indisponível (health proxy)." }, { status: 502 });
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
