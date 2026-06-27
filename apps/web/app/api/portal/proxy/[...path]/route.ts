import { NextRequest, NextResponse } from "next/server";
import { forwardSetCookieHeaders } from "@/lib/forward-set-cookie";
import { getServerApiBase } from "@/lib/server-api-base";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

/** fetch() descomprime gzip; não repassar Content-Encoding ao browser (ERR_CONTENT_DECODING_FAILED). */
const UPSTREAM_RESPONSE_SKIP = new Set(["content-encoding", "content-length", "transfer-encoding"]);

async function proxy(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const base = getServerApiBase();
  const subPath = pathSegments.join("/");
  const search = req.nextUrl.search;
  const target = `${base}/${subPath}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("X-RL-Portal-Cookie", "1");
  headers.set("Accept-Encoding", "identity");
  if (!headers.has("accept")) headers.set("Accept", "application/json");

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return NextResponse.json({ message: "Backend indisponível" }, { status: 502 });
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie") return;
    if (UPSTREAM_RESPONSE_SKIP.has(lower)) return;
    resHeaders.set(key, value);
  });

  const res = new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: resHeaders,
  });

  forwardSetCookieHeaders(upstream, res);

  return res;
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
