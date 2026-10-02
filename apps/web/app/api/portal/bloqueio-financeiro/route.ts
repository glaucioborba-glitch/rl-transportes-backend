import { NextRequest, NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/server-api-base";

/** Indica bloqueio financeiro do cliente logado (Hold Engine / inadimplência). */
export async function GET(req: NextRequest) {
  const base = getServerApiBase();
  try {
    const upstream = await fetch(`${base}/cliente/portal/dashboard?recentPage=1&recentLimit=1`, {
      method: "GET",
      headers: {
        Cookie: req.headers.get("cookie") ?? "",
        Accept: "application/json",
        Authorization: req.headers.get("authorization") ?? "",
        "X-RL-Portal-Cookie": req.headers.get("x-rl-portal-cookie") ?? "1",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ isBloqueadoFinanceiramente: false }, { status: upstream.status });
    }
    const data = (await upstream.json()) as { isBloqueadoFinanceiramente?: boolean };
    return NextResponse.json({
      isBloqueadoFinanceiramente: Boolean(data.isBloqueadoFinanceiramente),
    });
  } catch {
    return NextResponse.json({ isBloqueadoFinanceiramente: false }, { status: 502 });
  }
}
