import { NextRequest, NextResponse } from "next/server";
import { forwardSetCookieHeaders } from "@/lib/forward-set-cookie";
import { getServerApiBase } from "@/lib/server-api-base";
import {
  SA_ACTING_TENANT_COOKIE,
  SA_ACTING_TENANT_LABEL_COOKIE,
  actingCookieSecure,
} from "@/lib/super-admin-acting-cookie";

const TIMEOUT_MS = 15_000;

function clearActingCookies(res: NextResponse) {
  const secure = actingCookieSecure();
  res.cookies.set(SA_ACTING_TENANT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure,
  });
  res.cookies.set(SA_ACTING_TENANT_LABEL_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure,
  });
}

export async function POST(req: NextRequest) {
  const base = getServerApiBase();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-RL-Auth-Cookie": "1",
  };
  const cookie = req.headers.get("cookie");
  if (cookie) headers.Cookie = cookie;
  const csrf = req.headers.get("x-csrf-token");
  if (csrf) headers["X-CSRF-Token"] = csrf;

  let upstream: Response | null = null;
  try {
    upstream = await fetch(`${base}/super-admin/sair-intranet`, {
      method: "POST",
      headers,
      body: "{}",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    const res = NextResponse.json({ ok: true, upstream: false });
    clearActingCookies(res);
    return res;
  }

  const text = await upstream.text();
  const res = new NextResponse(text || JSON.stringify({ ok: true }), {
    status: upstream.ok ? 200 : upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  });
  forwardSetCookieHeaders(upstream, res);
  clearActingCookies(res);
  return res;
}
