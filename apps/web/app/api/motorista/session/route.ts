import { NextRequest, NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/server-api-base";
import {
  createMotoristaSessionValue,
  MOTORISTA_SESSION_COOKIE,
  MOTORISTA_SESSION_MAX_AGE_SEC,
} from "@/lib/motorista-signed-session";

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MOTORISTA_SESSION_MAX_AGE_SEC,
  };
}

/** Emite cookie HMAC após login corporativo do motorista (não aceita valor forjado `=1`). */
export async function POST(req: NextRequest) {
  const base = getServerApiBase();
  const auth = req.headers.get("authorization") ?? "";
  const cookie = req.headers.get("cookie") ?? "";
  if (!auth && !cookie) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/auth/me`, {
      method: "GET",
      headers: {
        Authorization: auth,
        Cookie: cookie,
        Accept: "application/json",
        "X-RL-Auth-Cookie": "1",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ message: "Backend indisponível" }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  let me: { sub?: string; id?: string };
  try {
    me = (await upstream.json()) as { sub?: string; id?: string };
  } catch {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }
  const userId = me.sub || me.id;
  const value = await createMotoristaSessionValue(userId ?? "");
  if (!value) {
    return NextResponse.json({ message: "Sessão motorista sem identidade ou segredo" }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(MOTORISTA_SESSION_COOKIE, value, cookieOpts());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MOTORISTA_SESSION_COOKIE, "", { ...cookieOpts(), maxAge: 0 });
  return res;
}
