"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, authLogin } from "@/lib/api/portal-client";
import { isAuthHttpOnlyMode } from "@/lib/auth-mode";
import { setStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { toast } from "@/lib/toast";
import { isStaffRole, useStaffAuthStore } from "@/stores/staff-auth-store";
import { RlLogo } from "@/components/portal/rl-logo";

function OperadorLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useStaffAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const cookieMode = isAuthHttpOnlyMode();
      const res = await authLogin(email, password, { cookieMode });
      if (!isStaffRole(res.user.role)) {
        setErr("Use o portal em /login para usuários CLIENTE.");
        toast.error("Perfil não autorizado nesta área.");
        return;
      }
      if (cookieMode) {
        setSession(null, null, res.user);
      } else {
        setSession(res.accessToken, res.refreshToken, res.user);
      }
      setStaffSessionCookie();
      toast.success("Sessão operacional iniciada");
      const next = searchParams.get("next") || "/operador/portaria";
      router.replace(next.startsWith("/") ? next : "/operador/portaria");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erro inesperado";
      setErr(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080a0d] px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <RlLogo className="h-11 w-11 text-lg" />
        <div>
          <h1 className="text-xl font-bold text-white">Operação de terminal</h1>
          <p className="text-sm text-slate-500">Portaria · Gate · Pátio · Cockpit</p>
        </div>
      </div>
      <Card className="w-full max-w-md border-white/10 bg-[#0c0f14]">
        <CardHeader>
          <CardTitle className="text-white">Entrar</CardTitle>
          <CardDescription>Perfis ADMIN, GERENTE ou operadores de campo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-300">
                E-mail
              </label>
              <Input
                id="email"
                className="border-white/15 bg-black/40 text-white"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            <Button type="submit" className="min-h-12 w-full text-base">
              Acessar
            </Button>
            <p className="text-center text-xs text-slate-500">
              <Link href="/login" className="text-[var(--accent)] hover:underline">
                Portal do cliente
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OperadorLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#080a0d] text-slate-500">
          Carregando…
        </div>
      }
    >
      <OperadorLoginInner />
    </Suspense>
  );
}
