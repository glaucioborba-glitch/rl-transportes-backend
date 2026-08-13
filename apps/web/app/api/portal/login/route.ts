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

const TIMEOUT_MS = 25_000;

function buildUpstreamHeaders(req: NextRequest, body?: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body) {
    headers["Content-Type"] = req.headers.get("content-type") || "application/json";
  }
  headers["X-RL-Portal-Cookie"] = "1";
  const cookie = req.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;
  for (const name of DEVICE_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers[name] = v;
  }
  const csrf = req.headers.get("x-csrf-token");
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const tenantId = req.headers.get("x-tenant-id");
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  return headers;
}

export async function POST(req: NextRequest) {
  const base = getServerApiBase();
  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/portal/login`, {
      method: "POST",
      headers: buildUpstreamHeaders(req, true),
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json(
      { message: `API indisponível (proxy → ${base}). Inicie o Nest (API_PORT=3001).` },
      { status: 502 },
    );
  }
  const text = await upstream.text();
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
  forwardSetCookieHeaders(upstream, res);
  return res;
}
