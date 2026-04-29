import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/portal")) {
    const session = request.cookies.get("rl_portal_session")?.value;
    if (!session) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/operador") && !pathname.startsWith("/operador/login")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/cockpit")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
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
  if (pathname.startsWith("/financeiro")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/rh")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/bi")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/ssma")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/grc")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/digital-twin")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/ai-console")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/sdt")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/aog")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  if (pathname.startsWith("/agi")) {
    const session = request.cookies.get("rl_staff_session")?.value;
    if (!session) {
      const login = new URL("/operador/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/portal/:path*",
    "/operador/:path*",
    "/cockpit/:path*",
    "/motorista/:path*",
    "/financeiro/:path*",
    "/rh",
    "/rh/:path*",
    "/admin",
    "/admin/:path*",
    "/bi",
    "/bi/:path*",
    "/ssma",
    "/ssma/:path*",
    "/grc",
    "/grc/:path*",
    "/digital-twin",
    "/digital-twin/:path*",
    "/ai-console",
    "/ai-console/:path*",
    "/sdt",
    "/sdt/:path*",
    "/aog",
    "/aog/:path*",
    "/agi",
    "/agi/:path*",
  ],
};
