"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DirectorAutopilot({
  loading,
  onAsk,
}: {
  loading?: boolean;
  onAsk: (q: string) => Promise<{ headline: string; body: string }>;
}) {
  const [q, setQ] = useState("");
  const [out, setOut] = useState<{ headline: string; body: string } | null>(null);

  async function send() {
    const t = q.trim();
    if (!t) return;
    const r = await onAsk(t);
    setOut(r);
  }

  return (
    <div className="rounded-2xl border border-slate-400/25 bg-[#0c0e12] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300/90">Director autopilot</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Ex.: "E se a demanda crescer 30%?"'
          className="border-slate-600/40 bg-black/40 sm:flex-1"
          onKeyDown={(e) => e.key === "Enter" && void send()}
        />
        <Button type="button" className="bg-slate-600 hover:bg-slate-500" disabled={loading} onClick={() => void send()}>
          Consultar
        </Button>
      </div>
      {out ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-lg font-light text-white">{out.headline}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{out.body}</p>
        </div>
      ) : null}
    </div>
  );
}
