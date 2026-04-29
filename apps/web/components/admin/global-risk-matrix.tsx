import { cn } from "@/lib/utils";

export type RiskCell = { id: string; label: string; score: number; nota?: string };

export function GlobalRiskMatrix({ rows }: { rows: RiskCell[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => {
        const tone = r.score >= 70 ? "red" : r.score >= 40 ? "amber" : "emerald";
        return (
          <div
            key={r.id}
            className={cn(
              "rounded-xl border p-4",
              tone === "red" && "border-red-500/30 bg-red-500/5",
              tone === "amber" && "border-amber-500/25 bg-amber-500/5",
              tone === "emerald" && "border-emerald-500/20 bg-emerald-500/5",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-100">{r.label}</p>
              <span className="font-mono text-lg font-bold text-white">{r.score}</span>
            </div>
            {r.nota ? <p className="mt-2 text-xs text-zinc-500">{r.nota}</p> : null}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  "h-full rounded-full",
                  tone === "red" && "bg-red-500",
                  tone === "amber" && "bg-amber-400",
                  tone === "emerald" && "bg-emerald-500",
                )}
                style={{ width: `${Math.min(100, r.score)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
