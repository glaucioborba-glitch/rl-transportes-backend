import { NextRequest, NextResponse } from "next/server";
import { forwardSetCookieHeaders } from "@/lib/forward-set-cookie";
import { getServerApiBase } from "@/lib/server-api-base";
import {
  SA_ACTING_TENANT_COOKIE,
  SA_ACTING_TENANT_LABEL_COOKIE,
} from "@/lib/super-admin-acting-cookie";

const TIMEOUT_MS = 15_000;
const SA_TENANT_SEC = 8 * 60 * 60;

export async function POST(req: NextRequest) {
  const base = getServerApiBase();
  const body = await req.text();
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") || "application/json",
    Accept: "application/json",
    "X-RL-Auth-Cookie": "1",
  };
  const cookie = req.headers.get("cookie");
  if (cookie) headers.Cookie = cookie;
  const csrf = req.headers.get("x-csrf-token");
  if (csrf) headers["X-CSRF-Token"] = csrf;

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/super-admin/entrar-intranet`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json(
      { message: `API indisponível (proxy → ${base}).` },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  });
  forwardSetCookieHeaders(upstream, res);

  if (upstream.ok) {
    try {
      const parsed = JSON.parse(text) as { tenantId?: string; nome?: string };
      if (parsed.tenantId) {
        const secure = process.env.NODE_ENV === "production";
        res.cookies.set(SA_ACTING_TENANT_COOKIE, parsed.tenantId, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: SA_TENANT_SEC,
          secure,
        });
        if (parsed.nome) {
          res.cookies.set(SA_ACTING_TENANT_LABEL_COOKIE, encodeURIComponent(parsed.nome), {
            httpOnly: false,
            sameSite: "lax",
            path: "/",
            maxAge: SA_TENANT_SEC,
            secure,
          });
        }
      }
    } catch {
      /* corpo inválido — cookies do Nest ainda podem ter sido repassados */
    }
  }

  return res;
}
