"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiError, getApiBase, portalClienteEsqueciSenha } from "@/lib/api/portal-client";
import { RlLogo } from "@/components/portal/rl-logo";

export default function PortalRecuperarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const mail = email.trim();
    if (!mail) {
      setErr("Informe o e-mail.");
      return;
    }
    setSubmitting(true);
    try {
      await portalClienteEsqueciSenha(mail);
      router.push("/portal/recuperar/sucesso");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível enviar";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080a0d] px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <RlLogo className="h-11 w-11 text-lg" />
        <div>
          <h1 className="text-xl font-bold text-white">Recuperar senha</h1>
          <p className="text-sm text-slate-500">POST /portal/esqueci-senha</p>
        </div>
      </div>

      <Card className="w-full max-w-md border-white/10">
        <CardHeader>
          <CardTitle>Esqueci minha senha</CardTitle>
          <CardDescription>
            Se o e-mail existir em nossa base, enviaremos instruções para redefinir a senha.
          </CardDescription>
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
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              disabled={submitting}
              className={cn(buttonVariants({ variant: "default", size: "default" }), "w-full min-h-10")}
            >
              {submitting ? "Enviando…" : "Enviar instruções"}
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
