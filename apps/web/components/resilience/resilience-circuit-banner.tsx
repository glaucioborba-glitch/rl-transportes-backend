"use client";

import { useEffect, useRef, useState } from "react";
import { RL_CIRCUIT_EVENT } from "@/lib/resilience/circuit-open";

/** Banner amarelo quando a API devolve `circuit-open` (Portal ou Staff). */
export function ResilienceCircuitBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const onEvt = (e: Event) => {
      const d = (e as CustomEvent<{ retryAfterMs?: number }>).detail;
      const retryMs = Math.max(1500, Math.floor((d?.retryAfterMs ?? 30_000) / 2));
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      setMsg(
        `Serviço temporariamente indisponível. Nova tentativa sugerida em ~${Math.round(retryMs / 1000)}s.`,
      );
      hideTimer.current = window.setTimeout(() => setMsg(null), Math.min(60_000, retryMs + 2000));
    };
    window.addEventListener(RL_CIRCUIT_EVENT, onEvt);
    return () => {
      window.removeEventListener(RL_CIRCUIT_EVENT, onEvt);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (!msg) return null;
  return (
    <div
      className="border-b border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-amber-100"
      role="status"
    >
      {msg}
    </div>
  );
}
