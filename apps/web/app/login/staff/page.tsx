"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  authLogin,
  sanitizeCorporateDocumento,
} from "@/lib/api/corporate-auth-client";
import { toast } from "@/lib/toast";
import { isStaffRole, useStaffAuthStore } from "@/stores/staff-auth-store";
import { RlLogo } from "@/components/portal/rl-logo";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import { validarCPF } from "@/lib/br-documents";
import { resolveStaffLoginDest } from "@/lib/staff-redirect";

function StaffLoginInner() {
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
      const result = await authLogin(documento, password, { cookieMode: true });
      if (!isStaffRole(result.user.role)) {
        setErr("Use o portal em /portal/login para usuários CLIENTE.");
        toast.error("Perfil não autorizado nesta área.");
        return;
      }
      setSession(null, null, result.user);
      toast.success("Sessão operacional iniciada");
      const dest = resolveStaffLoginDest(result.user.role, searchParams.get("next"));
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080a0d] px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <RlLogo className="h-11 w-11 text-lg" />
        <div>
          <h1 className="text-xl font-bold text-white">Intranet RL Transportes</h1>
          <p className="text-sm text-slate-500">Portaria · Gate · Pátio · Cockpit · Gestão</p>
        </div>
      </div>
      <Card className="w-full max-w-md border-white/10 bg-[#0c0f14]">
        <CardHeader>
          <CardTitle className="text-white">Entrar</CardTitle>
          <CardDescription>Acesso restrito a colaboradores — informe seu CPF cadastrado</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="documento" className="text-sm font-medium text-slate-300">
                CPF
              </label>
              <Input
                id="documento"
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
              <label htmlFor="password" className="text-sm font-medium text-slate-300">
                Senha
              </label>
              <Input
                id="password"
                className="border-white/15 bg-black/40 text-white"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {err ? <p className="text-sm text-red-400">{err}</p> : null}
            <Button type="submit" className="min-h-12 w-full text-base" disabled={submitting}>
              {submitting ? "Autenticando…" : "Acessar"}
            </Button>
            <p className="text-center text-xs text-slate-500">
              Use seu CPF cadastrado no RH. Em caso de esquecimento de senha, contate o departamento de TI.
              {" "}
              <Link href="/portal/login" className="text-[var(--accent)] hover:underline">
                Portal do cliente
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#080a0d] text-slate-500">
          Carregando…
        </div>
      }
    >
      <StaffLoginInner />
    </Suspense>
  );
}
