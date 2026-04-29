"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, authLogin } from "@/lib/api/portal-client";
import { setPortalSessionCookie } from "@/lib/auth-cookie";
import { toast } from "@/lib/toast";
import { usePortalAuthStore } from "@/stores/portal-store";
import { RlLogo } from "@/components/portal/rl-logo";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = usePortalAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await authLogin(email, password);
      if (res.user.role !== "CLIENTE") {
        setErr("Acesso permitido apenas para usuários com perfil CLIENTE.");
        toast.error("Perfil inválido para o portal.");
        return;
      }
      setSession(res.accessToken, res.refreshToken, res.user);
      setPortalSessionCookie();
      toast.success("Sessão iniciada");
      const next = searchParams.get("next") || "/portal/dashboard";
      router.replace(next.startsWith("/") ? next : "/portal/dashboard");
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
          <h1 className="text-xl font-bold text-white">Portal do cliente</h1>
          <p className="text-sm text-slate-500">RL Transportes · POST /auth/login</p>
        </div>
      </div>
      <Card className="w-full max-w-md border-white/10">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Credenciais do usuário portal (Role CLIENTE)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-300">
                E-mail
              </label>
              <Input
                id="email"
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
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {err ? <p className="text-sm text-red-300">{err}</p> : null}
            <Button type="submit" className="w-full">
              Acessar portal
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            <Link href="/" className="text-[var(--accent)] hover:underline">
              Voltar ao início
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
