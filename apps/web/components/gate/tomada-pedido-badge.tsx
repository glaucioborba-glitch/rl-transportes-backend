import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TomadaPedidoBadge({
  label,
  className,
}: {
  label: string | null | undefined;
  className?: string;
}) {
  if (!label) return null;
  const sim = label.toUpperCase().includes("SIM");
  return (
    <Badge
      variant="neutral"
      className={cn(
        "text-xs font-semibold",
        sim
          ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
          : "border-white/15 bg-white/5 text-slate-300",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
