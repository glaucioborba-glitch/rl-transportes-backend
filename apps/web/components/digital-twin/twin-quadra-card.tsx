"use client";

import type { MappedQuadra } from "@/lib/digital-twin/derive";
import { bandColorCss } from "@/lib/digital-twin/derive";

export function TwinQuadraCard({ q, throughputProxy }: { q: MappedQuadra; throughputProxy: number }) {
  const c = bandColorCss(q.risk);
  return (
    <div
      className="rounded-xl border bg-[#070c18]/90 p-4 shadow-inner transition-colors"
      style={{ borderColor: c.stroke }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">{q.label}</p>
        <span className="font-mono text-xs text-cyan-300/80">{q.ocupacao} u.</span>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Dwell proxy: {q.dwellProxyMin != null ? `${Math.round(q.dwellProxyMin)} min` : "—"} · TP est.: {throughputProxy.toFixed(1)} u/h
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, (q.ocupacao / 60) * 100)}%`, backgroundColor: c.stroke }}
        />
      </div>
    </div>
  );
}
