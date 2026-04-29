import { cn } from "@/lib/utils";

export function SlaGauge({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 85 ? "emerald" : v >= 60 ? "amber" : "red";
  const bar =
    tone === "emerald"
      ? "from-emerald-400 to-cyan-500"
      : tone === "amber"
        ? "from-amber-400 to-orange-500"
        : "from-red-500 to-rose-600";
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        <span
          className={cn(
            "text-lg font-bold tabular-nums",
            tone === "emerald" && "text-emerald-300",
            tone === "amber" && "text-amber-200",
            tone === "red" && "text-red-300",
          )}
        >
          {v}%
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={cn("h-full rounded-full bg-gradient-to-r", bar)} style={{ width: `${v}%` }} />
      </div>
      {hint ? <p className="mt-2 text-[11px] leading-snug text-zinc-500">{hint}</p> : null}
    </div>
  );
}
