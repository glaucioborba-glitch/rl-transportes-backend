"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ensurePortalPessoaSessionForPortal,
  ensurePortalHealthPolling,
  fetchPortalDashboard,
  inferPortalClienteTipo,
  portalHydrateSessionFromCookies,
  portalMinhasPermissoes,
} from "@/lib/api/portal-client";
import { isPortalCookieAuthMode, hasPortalClientSession } from "@/lib/portal-auth-mode";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";
import { usePessoaPermissoesStore, DEFAULT_PERMISSOES } from "@/stores/pessoaPermissoesStore";
import { PortalHeader } from "./portal-header";
import { PortalFinanceiroBlockBanner } from "./portal-financeiro-block-banner";
import { PortalSecurityBanner } from "./portal-security-banner";
import { ResilienceCircuitBanner } from "@/components/resilience/resilience-circuit-banner";

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = usePortalClienteAuthStore((s) => s.accessToken);
  const sessionHydrated = usePortalClienteAuthStore((s) => s.sessionHydrated);
  const user = usePortalClienteAuthStore((s) => s.user);
  const cookieMode = isPortalCookieAuthMode();
  const hasSession = hasPortalClientSession({ accessToken, sessionHydrated, user });
  const userTipo = user?.tipo ?? inferPortalClienteTipo(user);
  const userCpfCnpj = user?.cpfCnpj;
  const pessoaId = usePessoaAutorizadaStore((s) => s.pessoa?.id ?? null);
  const storedPermissoes = usePessoaPermissoesStore((s) => s.permissoes);
  const boundPessoaId = usePessoaPermissoesStore((s) => s.boundPessoaId);
  const setPermissoes = usePessoaPermissoesStore((s) => s.setPermissoes);
  const permissoesLoadedRef = useRef<string | null>(null);
  const bootstrapAttemptedRef = useRef(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_MOCK_AUTH !== "1") return;
    try {
      const raw = sessionStorage.getItem("e2e-portal-session");
      if (!raw) return;
      const data = JSON.parse(raw) as {
        accessToken: string;
        refreshToken: string;
        user: NonNullable<ReturnType<typeof usePortalClienteAuthStore.getState>["user"]>;
        pessoa?: { id: string; nome: string; email: string; telefone: string | null };
        permissoes?: typeof DEFAULT_PERMISSOES;
      };
      usePortalClienteAuthStore.getState().setSession(data.accessToken, data.refreshToken, data.user);
      if (data.pessoa) usePessoaAutorizadaStore.getState().setPessoa(data.pessoa);
      if (data.pessoa && data.permissoes) {
        usePessoaPermissoesStore.getState().setPermissoes(data.permissoes, data.pessoa.id);
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    ensurePortalHealthPolling();
  }, []);

  useEffect(() => {
    if (cookieMode && !sessionHydrated) {
      void portalHydrateSessionFromCookies();
    }
  }, [cookieMode, sessionHydrated]);

  useEffect(() => {
    if (!hasSession) return;
    const st = usePortalClienteAuthStore.getState();
    if (st.cliente?.id || st.clienteNome) return;
    void fetchPortalDashboard({ recentPage: 1, recentLimit: 1 })
      .then((dash) => {
        const c = dash.cliente;
        if (!c?.id) return;
        usePortalClienteAuthStore.getState().setCliente({
          id: c.id,
          nomeFantasia: null,
          razaoSocial: typeof c.nome === "string" ? c.nome.trim() || null : null,
          cpfCnpj: typeof c.cpfCnpj === "string" ? c.cpfCnpj : "",
        });
        usePortalClienteAuthStore.getState().setBloqueioFinanceiro(Boolean(dash.isBloqueadoFinanceiramente));
      })
      .catch(() => {
        usePortalClienteAuthStore.getState().setBloqueioFinanceiro(false);
      });
  }, [hasSession]);

  useEffect(() => {
    const auth = usePortalClienteAuthStore.getState();
    const sessionOk = hasPortalClientSession({
      accessToken: auth.accessToken,
      sessionHydrated: auth.sessionHydrated,
      user: auth.user,
    });
    if (!sessionOk) {
      router.replace(`/portal/login?next=${encodeURIComponent(pathname ?? "/portal/dashboard")}`);
      return;
    }

    const pessoaAtual = usePessoaAutorizadaStore.getState().pessoa?.id ?? null;
    const tipo =
      auth.user?.tipo ?? inferPortalClienteTipo(auth.user);
    const cpfCnpj = auth.user?.cpfCnpj;

    if (pessoaAtual) {
      bootstrapAttemptedRef.current = false;
      setBootstrapError(null);
      setBootstrapping(false);
      return;
    }

    if (pathname === "/portal/auth/select-pessoa") return;

    if (tipo === "PJ" || (tipo === null && (cpfCnpj?.replace(/\D/g, "").length ?? 0) === 14)) {
      router.replace(
        `/portal/auth/select-pessoa?next=${encodeURIComponent(pathname ?? "/portal/dashboard")}`,
      );
      return;
    }

    if (tipo === "PF" && cpfCnpj && !bootstrapAttemptedRef.current) {
      bootstrapAttemptedRef.current = true;
      setBootstrapping(true);
      setBootstrapError(null);
      void ensurePortalPessoaSessionForPortal({ cpfCnpj, force: true })
        .then((r) => {
          if (r.status === "ok") return;
          if (r.status === "need-select") {
            router.replace(
              `/portal/auth/select-pessoa?next=${encodeURIComponent(pathname ?? "/portal/dashboard")}`,
            );
            return;
          }
          setBootstrapError(r.message);
        })
        .catch(() => {
          setBootstrapError("Não foi possível confirmar sua identidade. Tente novamente.");
        })
        .finally(() => {
          setBootstrapping(false);
        });
      return;
    }

    if (!pessoaAtual) {
      router.replace(
        `/portal/auth/select-pessoa?next=${encodeURIComponent(pathname ?? "/portal/dashboard")}`,
      );
    }
  }, [hasSession, pessoaId, userTipo, userCpfCnpj, pathname, router]);

  useEffect(() => {
    if (!hasSession || !pessoaId) return;
    if (permissoesLoadedRef.current === pessoaId) return;

    if (storedPermissoes && boundPessoaId === pessoaId) {
      permissoesLoadedRef.current = pessoaId;
      return;
    }

    permissoesLoadedRef.current = pessoaId;
    void portalMinhasPermissoes()
      .then((perm) => {
        setPermissoes(perm ?? DEFAULT_PERMISSOES, pessoaId);
      })
      .catch(() => {
        setPermissoes(DEFAULT_PERMISSOES, pessoaId);
      });
  }, [hasSession, pessoaId, setPermissoes, storedPermissoes, boundPessoaId]);

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a0d] text-slate-400">
        Redirecionando…
      </div>
    );
  }

  if (!pessoaId && pathname !== "/portal/auth/select-pessoa") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#080a0d] px-4 text-center text-slate-400">
        <p>{bootstrapping ? "Confirmando identidade…" : "Redirecionando…"}</p>
        {bootstrapError ? (
          <p className="max-w-sm text-sm text-red-300" role="alert">
            {bootstrapError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]">
      <PortalHeader />
      <PortalFinanceiroBlockBanner />
      <ResilienceCircuitBanner />
      <PortalSecurityBanner />
      {children}
    </div>
  );
}
