"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiError, getApiBase, portalClienteRedefinirSenha } from "@/lib/api/portal-client";
import { evaluatePassword } from "@/lib/security/password-validator";
import { toast } from "@/lib/toast";
import { PasswordStrengthPanel } from "@/components/portal/password-strength-panel";
import { RlLogo } from "@/components/portal/rl-logo";

export default function PortalRedefinirSenhaPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!token.trim()) {
      setErr("Link inválido.");
      return;
    }
    if (password !== confirm) {
      setErr("As senhas não coincidem.");
      toast.error("As senhas não coincidem.");
      return;
    }
    const pw = evaluatePassword(password);
    if (!pw.valid) {
      const hint = "A senha não atende aos requisitos mínimos de segurança.";
      setErr(hint);
      toast.error(hint);
      return;
    }
    setSubmitting(true);
    try {
      const { message } = await portalClienteRedefinirSenha(token.trim(), password);
      toast.success(message);
      router.replace("/portal/login");
    } catch (e) {
      let msg = "Não foi possível redefinir";
      if (e instanceof ApiError) {
        msg = e.detail ? `${e.message} (${e.detail})` : e.message;
      }
      setErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080a0d] px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <RlLogo className="h-11 w-11 text-lg" />
        <div>
          <h1 className="text-xl font-bold text-white">Nova senha</h1>
          <p className="text-sm text-slate-500">POST /portal/redefinir-senha</p>
        </div>
      </div>

      <Card className="w-full max-w-md border-white/10">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="pwd" className="text-sm font-medium text-slate-300">
                Nova senha
              </label>
              <Input
                id="pwd"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <PasswordStrengthPanel password={password} />
            </div>
            <div className="space-y-2">
              <label htmlFor="pwd2" className="text-sm font-medium text-slate-300">
                Confirmar nova senha
              </label>
              <Input
                id="pwd2"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {err ? (
              <p className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200" role="alert">
                {err}
              </p>
            ) : null}
            <p className="text-[11px] text-slate-500">API: {getApiBase()}</p>
            <button
              type="submit"
              disabled={submitting || !token}
              className={cn(buttonVariants({ variant: "default", size: "default" }), "w-full min-h-10")}
            >
              {submitting ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            <Link href="/portal/login" className="text-[var(--accent)] hover:underline">
              Voltar ao login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
