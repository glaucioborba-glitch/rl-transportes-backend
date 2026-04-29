"use client";

export function ExecutiveAlerts({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-2xl border border-red-500/25 bg-red-950/15 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-red-200/90">Alertas críticos</p>
      <ul className="mt-3 space-y-2 text-xs text-red-100/90">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-red-400">▸</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
