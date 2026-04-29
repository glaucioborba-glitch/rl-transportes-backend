"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileButton } from "@/components/motorista/mobile-button";
import { BigInput } from "@/components/motorista/big-input";
import { ApiError, authLogin } from "@/lib/api/portal-client";
import { setMotoristaSessionCookie } from "@/lib/auth-motorista-cookie";
import { toast } from "@/lib/toast";
import { useMotoristaAuthStore } from "@/stores/motorista-auth-store";
import { RlLogo } from "@/components/portal/rl-logo";

const RECENT_KEY = "rl_motorista_recent_emails";

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(email: string) {
  const e = email.trim().toLowerCase();
  if (!e) return;
  const prev = readRecent().filter((x) => x !== e);
  prev.unshift(e);
  localStorage.setItem(RECENT_KEY, JSON.stringify(prev.slice(0, 5)));
}

function MotoristaLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useMotoristaAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await authLogin(email, password);
      setSession(res.accessToken, res.refreshToken, res.user);
      pushRecent(email);
      setMotoristaSessionCookie();
      vibrateOk();
      toast.success("Bem-vindo ao app do motorista");
      const next = searchParams.get("next") || "/motorista/checkin";
      router.replace(next.startsWith("/motorista") ? next : "/motorista/checkin");
    } catch (er) {
      const msg = er instanceof ApiError ? er.message : "Erro inesperado";
      setErr(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#080a0d] px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <RlLogo className="h-14 w-14 text-lg" />
          <h1 className="text-2xl font-bold text-white">Portal do motorista</h1>
          <p className="text-sm text-slate-500">Check-in digital e senha eletrônica</p>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-3xl border border-white/10 bg-[#0c1018] p-5 shadow-xl">
          <BigInput
            label="E-mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            list="motorista-recent-emails"
          />
          <datalist id="motorista-recent-emails">
            {recent.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <BigInput
            label="Senha"
            type="password"
            autoComplete="current-password"
            inputMode="numeric"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          <MobileButton type="submit">Entrar</MobileButton>
          <p className="text-center text-xs text-slate-500">
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Portal do cliente (desktop)
            </Link>
            {" · "}
            <Link href="/operador/login" className="text-slate-400 hover:underline">
              Operação
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function vibrateOk() {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
}

export default function MotoristaLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080a0d]" />}>
      <MotoristaLoginInner />
    </Suspense>
  );
}
