"use client";

import type { RhNrRecord } from "@/lib/rh/types";

export function TrainingTimeline({
  nr,
  roleChanges,
}: {
  nr: RhNrRecord[];
  roleChanges: { at: string; label: string }[];
}) {
  const items = [
    ...nr.map((r) => ({
      at: r.validade,
      label: `${r.code} — ${r.label} (${r.status})`,
      kind: "nr" as const,
    })),
    ...roleChanges.map((x) => ({ ...x, kind: "role" as const })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <ol className="relative border-l border-cyan-500/25 pl-4">
      {items.map((it, i) => (
        <li key={i} className="mb-6 ml-1">
          <span
            className={
              it.kind === "nr"
                ? "absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                : "absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-violet-400"
            }
          />
          <p className="text-xs text-zinc-500">{it.at}</p>
          <p className="text-sm text-zinc-200">{it.label}</p>
        </li>
      ))}
    </ol>
  );
}
