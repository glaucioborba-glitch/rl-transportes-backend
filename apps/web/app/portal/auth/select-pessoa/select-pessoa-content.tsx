"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ApiError,
  ensurePortalPessoaSessionForPortal,
  inferPortalClienteTipo,
  portalMinhasPermissoes,
  portalValidarPessoa,
  clearPortalMinhasPermissoesCache,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";
import { usePessoaPermissoesStore } from "@/stores/pessoaPermissoesStore";
import { RlLogo } from "@/components/portal/rl-logo";
import { DEFAULT_PORTAL_HOME, sanitizePortalPath } from "@/lib/portal-redirect";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import { validateCpfDigits } from "@/lib/br-documents";
import { hasPortalClientSession } from "@/lib/portal-auth-mode";

export function SelectPessoaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeNext = sanitizePortalPath(searchParams.get("next") ?? DEFAULT_PORTAL_HOME);
  const accessToken = usePortalClienteAuthStore((s) => s.accessToken);
  const sessionHydrated = usePortalClienteAuthStore((s) => s.sessionHydrated);
  const user = usePortalClienteAuthStore((s) => s.user);
  const hasSession = hasPortalClientSession({ accessToken, sessionHydrated, user });
  const userTipo = user?.tipo ?? inferPortalClienteTipo(user);
  const userCpfCnpj = user?.cpfCnpj;
  const pessoaId = usePessoaAutorizadaStore((s) => s.pessoa?.id ?? null);
  const setPessoa = usePessoaAutorizadaStore((s) => s.setPessoa);
  const setPermissoes = usePessoaPermissoesStore((s) => s.setPermissoes);

  const [cpf, setCpf] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pfBypassing, setPfBypassing] = useState(false);

  useEffect(() => {
    if (!hasSession) {
      router.replace(`/portal/login?next=${encodeURIComponent("/portal/auth/select-pessoa")}`);
      return;
    }
    if (userTipo !== "PF") return;

    setPfBypassing(true);
    setErr(null);
    void ensurePortalPessoaSessionForPortal({ cpfCnpj: userCpfCnpj, force: true }).then((r) => {
      if (r.status === "ok") {
        router.replace(safeNext);
        return;
      }
      setPfBypassing(false);
      setErr(
        r.status === "error"
          ? r.message
          : "Não foi possível confirmar sua identidade automaticamente.",
      );
    });
  }, [hasSession, userTipo, userCpfCnpj, router, safeNext]);

  if (!hasSession) {
    return null;
  }

  if (userTipo === "PF" && (pfBypassing || pessoaId)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a0d] text-slate-400">
        {err ? (
          <Card className="w-full max-w-md border-white/10">
            <CardHeader>
              <CardTitle className="text-red-200">Identidade PF</CardTitle>
              <CardDescription>{err}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/portal/login" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                Voltar ao login
              </Link>
            </CardContent>
          </Card>
        ) : (
          "Redirecionando…"
        )}
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      const msg = "Informe um CPF válido com 11 dígitos.";
      setErr(msg);
      toast.error(msg);
      return;
    }
    if (!validateCpfDigits(digits)) {
      const msg = "CPF inválido. Verifique os dígitos.";
      setErr(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      const saved = await portalValidarPessoa(digits);
      setPessoa({
        id: saved.id,
        nome: saved.nome,
        email: saved.email,
        telefone: saved.telefone,
      });
      clearPortalMinhasPermissoesCache();
      const perm = await portalMinhasPermissoes({ force: true });
      if (perm) setPermissoes(perm, saved.id);
      toast.success(`Bem-vindo(a), ${saved.nome}`);
      router.replace(safeNext);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? "CPF não encontrado ou não autorizado para esta empresa."
          : e instanceof ApiError
            ? e.message
            : "Não foi possível validar seu CPF. Tente novamente.";
      setErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#080a0d] px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <RlLogo className="h-11 w-11 text-lg" />
      </div>

      <Card className="w-full max-w-md border-white/10">
        <CardHeader>
          <CardTitle>Confirme sua identidade</CardTitle>
          <CardDescription>Digite seu CPF para acessar o portal da empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="cpf-identidade" className="text-sm font-medium text-slate-300">
                CPF
              </label>
              <Input
                id="cpf-identidade"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCpfBr(e.target.value))}
                required
                disabled={submitting}
              />
            </div>

            {err ? (
              <p
                className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200"
                role="alert"
              >
                {err}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className={cn(buttonVariants({ variant: "default" }), "w-full min-h-10")}
            >
              {submitting ? "Validando…" : "Acessar"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            <Link href="/portal/login" className="text-[var(--accent)] hover:underline">
              Sair e trocar conta
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
