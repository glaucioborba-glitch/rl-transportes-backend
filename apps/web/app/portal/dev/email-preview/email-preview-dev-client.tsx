"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/api/portal-client";
import { RlLogo } from "@/components/portal/rl-logo";

type Props = {
  token?: string;
  nome?: string;
};

export function EmailPreviewDevClient({ token, nome }: Props) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (token?.trim()) sp.set("token", token.trim());
    if (nome?.trim()) sp.set("nome", nome.trim());
    const q = sp.toString();
    const url = `${getApiBase()}/portal/email-preview${q ? `?${q}` : ""}`;
    let cancelled = false;
    void fetch(url, { credentials: "include" })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
        if (!cancelled) setHtml(text);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar preview");
      });
    return () => {
      cancelled = true;
    };
  }, [token, nome]);

  return (
    <div className="flex min-h-screen flex-col bg-[#080a0d] px-4 py-10">
      <div className="mx-auto mb-6 flex w-full max-w-4xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RlLogo className="h-10 w-10 text-lg" />
          <div>
            <h1 className="text-lg font-bold text-white">Preview — e-mail de recuperação</h1>
            <p className="text-xs text-slate-500">GET /portal/email-preview (somente desenvolvimento)</p>
          </div>
        </div>
        <Link href="/portal/login" className="text-xs text-[var(--accent)] hover:underline">
          Login
        </Link>
      </div>

      {error ? (
        <p className="mx-auto w-full max-w-4xl rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <iframe
        title="Pré-visualização do e-mail"
        className="mx-auto mt-4 min-h-[720px] w-full max-w-4xl flex-1 rounded-lg border border-white/10 bg-white"
        srcDoc={html}
        sandbox="allow-same-origin"
      />
    </div>
  );
}
