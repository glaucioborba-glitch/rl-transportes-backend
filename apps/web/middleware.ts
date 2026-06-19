import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const STAFF_PREFIXES = [
  "/operador",
  "/cockpit",
  "/financeiro",
  "/rh",
  "/admin",
  "/bi",
  "/ssma",
  "/grc",
  "/digital-twin",
  "/ai-console",
  "/sdt",
  "/aog",
  "/agi",
  "/staff",
  "/intranet",
];

function isStaffProtectedPath(pathname: string): boolean {
  if (
    pathname.startsWith("/login/staff") ||
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/operador/login")
  ) {
    return false;
  }
  return STAFF_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaffProtectedPath(pathname)) {
    const verify = new URL("/api/auth/me", request.url);
    const res = await fetch(verify, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) {
      const login = new URL("/login/staff", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/motorista") && !pathname.startsWith("/motorista/login")) {
    const session = request.cookies.get("rl_motorista_session")?.value;
    if (!session) {
      const login = new URL("/motorista/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

/**
 * Nunca executar middleware em assets estáticos / rotas internas do Next.
 * Evita interferência com `/_next/static/*` (404 de chunks em dev após troca build↔dev).
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
