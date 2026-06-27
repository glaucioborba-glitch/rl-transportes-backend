import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isPortalAgendamentoPath } from "@/lib/portal-financeiro-block";

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
  "/super-admin",
];

const PORTAL_PUBLIC_PREFIXES = [
  "/portal/login",
  "/portal/cadastrar",
  "/portal/recuperar",
  "/portal/redefinir",
  "/portal/auth/select-pessoa",
  "/portal/dev/email-preview",
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

function isPortalProtectedPath(pathname: string): boolean {
  if (!pathname.startsWith("/portal") && !pathname.startsWith("/cliente/portal")) return false;
  return !PORTAL_PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /** Playwright E2E: auth real via mock de rede (`page.route`); middleware não bloqueia rotas protegidas. */
  if (process.env.E2E_MOCK_AUTH === "1") {
    return NextResponse.next();
  }

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
    if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) {
      const me = (await res.json()) as { role?: string };
      if (me.role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/staff", request.url));
      }
    }
  }

  if (isPortalProtectedPath(pathname) && process.env.NEXT_PUBLIC_PORTAL_COOKIE_AUTH === "1") {
    const verify = new URL("/api/portal/me", request.url);
    const res = await fetch(verify, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) {
      const login = new URL("/portal/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }

    if (isPortalAgendamentoPath(pathname)) {
      const bloqueio = new URL("/api/portal/bloqueio-financeiro", request.url);
      const bRes = await fetch(bloqueio, {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      if (bRes.ok) {
        const body = (await bRes.json()) as { isBloqueadoFinanceiramente?: boolean };
        if (body.isBloqueadoFinanceiramente) {
          const dash = new URL("/portal/dashboard", request.url);
          dash.searchParams.set("bloqueioFinanceiro", "1");
          return NextResponse.redirect(dash);
        }
      }
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
