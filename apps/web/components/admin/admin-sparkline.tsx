import { cn } from "@/lib/utils";

export function AdminSparkline({ values, className }: { values: number[]; className?: string }) {
  if (!values.length) return <span className="text-zinc-600">—</span>;
  const m = Math.max(...values, 1);
  return (
    <div className={cn("flex h-10 items-end gap-px", className)}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-gradient-to-t from-emerald-600/40 to-emerald-400/90"
          style={{ height: `${Math.max(8, (v / m) * 100)}%` }}
        />
      ))}
    </div>
  );
}
