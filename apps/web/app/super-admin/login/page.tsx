"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, authLogin, sanitizeCorporateDocumento } from "@/lib/api/corporate-auth-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import { validarCPF } from "@/lib/br-documents";
import { ThemeToggle } from "@/components/theme-toggle";

function SuperAdminLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useStaffAuthStore((s) => s.setSession);
  const [documento, setDocumento] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const cpf = sanitizeCorporateDocumento(documento);
    if (cpf.length !== 11) {
      const msg = "CPF deve conter 11 dígitos";
      setErr(msg);
      toast.error(msg);
      return;
    }
    if (!validarCPF(cpf)) {
      const msg = "CPF inválido";
      setErr(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      const result = await authLogin(documento, password, { cookieMode: true, superAdmin: true });
      if (result.user.role !== "SUPER_ADMIN") {
        const msg = "Este acesso é exclusivo do Super Admin.";
        setErr(msg);
        toast.error(msg);
        return;
      }
      setSession(null, null, result.user);
      toast.success("Sessão Super Admin iniciada");
      const next = searchParams.get("next");
      const dest =
        next && next.startsWith("/super-admin") && !next.startsWith("/super-admin/login")
          ? next
          : "/super-admin";
      router.push(dest);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Erro inesperado";
      setErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-400">Dono do software</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Super Admin</h1>
        <p className="mt-1 text-sm text-zinc-500">Acesso à plataforma — não é a intranet do terminal</p>
      </div>
      <Card className="w-full max-w-md border-violet-500/20 bg-zinc-950">
        <CardHeader>
          <CardTitle className="text-white">Entrar</CardTitle>
          <CardDescription>CPF do dono. A intranet operacional fica em /login/staff.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="sa-cpf" className="text-sm font-medium text-zinc-300">
                CPF
              </label>
              <Input
                id="sa-cpf"
                className="border-white/15 bg-black/40 text-white"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                placeholder="000.000.000-00"
                maxLength={14}
                value={documento}
                onChange={(e) => setDocumento(formatCpfBr(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sa-password" className="text-sm font-medium text-zinc-300">
                Senha
              </label>
              <Input
                id="sa-password"
                className="border-white/15 bg-black/40 text-white"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {err ? <p className="text-sm text-red-400">{err}</p> : null}
            <Button
              type="submit"
              className="min-h-12 w-full bg-violet-600 text-base hover:bg-violet-500"
              disabled={submitting}
            >
              {submitting ? "Autenticando…" : "Acessar Super Admin"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
          Carregando…
        </div>
      }
    >
      <SuperAdminLoginInner />
    </Suspense>
  );
}
