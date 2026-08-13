import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value?: string | null;
  className?: string;
};

export function DataField({ label, value, className }: Props) {
  return (
    <div className={cn(className)}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{value?.trim() || "—"}</p>
    </div>
  );
}
