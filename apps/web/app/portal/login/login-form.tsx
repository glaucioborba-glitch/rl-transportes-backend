"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ApiError,
  ensurePortalPessoaSessionForPortal,
  getApiBase,
  inferPortalClienteTipo,
  mapPortalLoginToUser,
  portalClienteLogin,
  portalMinhasPermissoes,
  clearPortalMinhasPermissoesCache,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { RlLogo } from "@/components/portal/rl-logo";
import { DEFAULT_PORTAL_HOME, sanitizePortalPath } from "@/lib/portal-redirect";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { validateCnpjDigits, validateCpfDigits } from "@/lib/br-documents";

type LoginFormProps = {
  redirectAfterLogin?: string;
};

export default function PortalLoginForm({ redirectAfterLogin = DEFAULT_PORTAL_HOME }: LoginFormProps) {
  const router = useRouter();
  const safeNext = sanitizePortalPath(redirectAfterLogin);
  const [documento, setDocumento] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function setErrorMessage(msg: string) {
    setErr(msg);
    setStatus(null);
    try {
      toast.error(msg);
    } catch {
      /* */
    }
  }

  async function runLogin() {
    const apiHint = ` (API: ${getApiBase()})`;
    try {
      setErr(null);
      setStatus(null);
      const digits = documento.replace(/\D/g, "");
      const pwd = password.trim();
      if (digits.length === 11) {
        if (!validateCpfDigits(digits)) {
          setErrorMessage("CPF inválido. Verifique os dígitos.");
          return;
        }
      } else if (digits.length === 14) {
        if (!validateCnpjDigits(digits)) {
          setErrorMessage("CNPJ inválido. Verifique os dígitos.");
          return;
        }
      } else {
        setErrorMessage("Documento inválido. Informe um CPF ou CNPJ válido.");
        return;
      }
      if (!pwd) {
        setErrorMessage("Informe CPF/CNPJ e senha.");
        return;
      }
      setSubmitting(true);
      setStatus("Autenticando…");
      const raw = await portalClienteLogin(documento, pwd);
      if (String(raw.portalIdentity.portalPapel).toUpperCase() !== "CLIENTE") {
        setErrorMessage("Acesso permitido apenas para perfil CLIENTE.");
        return;
      }
      const user = mapPortalLoginToUser(raw);
      const { usePessoaAutorizadaStore } = await import("@/stores/pessoaAutorizadaStore");
      const { usePessoaPermissoesStore } = await import("@/stores/pessoaPermissoesStore");
      usePessoaAutorizadaStore.getState().clear();
      usePessoaPermissoesStore.getState().clear();
      clearPortalMinhasPermissoesCache();
      usePortalClienteAuthStore.getState().setSession(raw.accessToken, raw.refreshToken, user);
      if (raw.cliente !== undefined) {
        usePortalClienteAuthStore.getState().setCliente(raw.cliente);
      }
      setStatus("Login ok. Abrindo portal…");
      try {
        toast.success("Sessão iniciada");
      } catch {
        /* */
      }

      const tipo = user.tipo ?? raw.tipo ?? raw.usuario?.tipo ?? inferPortalClienteTipo(user);
      const destino =
        safeNext.startsWith("/portal/auth/select-pessoa") ? DEFAULT_PORTAL_HOME : safeNext;

      if (raw.skipSelectPessoa && raw.pessoaAutorizada) {
        usePessoaAutorizadaStore.getState().setPessoa({
          id: raw.pessoaAutorizada.id,
          nome: raw.pessoaAutorizada.nome,
          email: raw.pessoaAutorizada.email,
          telefone: raw.pessoaAutorizada.telefone,
        });
        clearPortalMinhasPermissoesCache();
        const perm = await portalMinhasPermissoes({ force: true });
        if (perm) {
          usePessoaPermissoesStore.getState().setPermissoes(perm, raw.pessoaAutorizada.id);
        }
        router.replace(destino);
        return;
      }

      if (tipo === "PF") {
        setStatus("Confirmando identidade…");
        try {
          const r = await ensurePortalPessoaSessionForPortal({
            cpfCnpj: user.cpfCnpj,
            pessoaFromLogin: raw.pessoaAutorizada,
            force: Boolean(raw.pessoaAutorizada),
          });
          if (r.status === "ok") {
            router.replace(destino);
            return;
          }
          if (r.status === "need-select") {
            router.replace(`/portal/auth/select-pessoa?next=${encodeURIComponent(destino)}`);
            return;
          }
          setErrorMessage(r.message);
        } catch (e) {
          const msg =
            e instanceof ApiError
              ? e.message
              : "Não foi possível vincular o titular (PF). Verifique seu cadastro ou contate o suporte.";
          setErrorMessage(msg);
        }
        return;
      }

      router.replace(
        safeNext.startsWith("/portal/auth/select-pessoa")
          ? safeNext
          : `/portal/auth/select-pessoa?next=${encodeURIComponent(safeNext)}`,
      );
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message + (e.status === 0 ? apiHint : "")
          : e instanceof TypeError
            ? `Não foi possível contatar a API${apiHint}.`
            : e instanceof Error && e.message
              ? e.message
              : `Erro inesperado${apiHint}`;
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080a0d] px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <RlLogo className="h-10 w-10 text-lg" />
        <div>
          <h1 className="text-xl font-bold text-white">Portal do cliente</h1>
          <p className="text-sm text-slate-500">RL Transportes</p>
        </div>
      </div>
      <Card className="w-full max-w-md border border-muted-foreground/20 bg-[#0c0f14] shadow-none ring-1 ring-muted-foreground/10">
        <CardHeader className="space-y-1 px-6 pb-0 pt-6">
          <CardTitle className="text-white">Entrar</CardTitle>
          <CardDescription>Acesse sua conta para gerenciar suas operações.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-3">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void runLogin().catch(() => setSubmitting(false));
            }}
            className="flex flex-col gap-y-3"
          >
            <div className="flex flex-col gap-y-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="documento" className="text-sm font-medium text-slate-300">
                  CPF ou CNPJ
                </label>
                <Input
                  id="documento"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={documento}
                  onChange={(e) => setDocumento(formatCpfCnpjBr(e.target.value))}
                  className="h-9 border-white/15 bg-black/40 py-2 text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Senha
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 border-white/15 bg-black/40 py-2 text-white"
                />
              </div>
            </div>
            {status && !err ? (
              <p className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-2 text-sm text-cyan-100">
                {status}
              </p>
            ) : null}
            {err ? (
              <p
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200"
              >
                {err}
              </p>
            ) : null}
            <div className="flex flex-col gap-y-4 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "h-auto w-full px-6 py-2.5",
                )}
              >
                {submitting ? "Entrando…" : "Acessar portal"}
              </button>
              <div className="flex flex-col gap-2">
                <Link
                  href="/portal/cadastrar"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "h-auto w-full border-white/15 px-6 py-2.5 text-slate-100 hover:bg-white/5",
                  )}
                >
                  Cadastrar-se
                </Link>
                <Link
                  href="/portal/recuperar"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "default" }),
                    "h-auto w-full px-6 py-2.5 text-slate-400 hover:text-slate-200",
                  )}
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            <Link href="/" className="text-[var(--accent)] hover:underline">
              Voltar ao início
            </Link>
            {" · "}
            <Link href="/login/staff" className="text-[var(--accent)] hover:underline">
              Intranet
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
