import { cn } from "@/lib/utils";

export function RlLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-sky-600 text-sm font-black tracking-tight text-white shadow-lg shadow-[var(--accent)]/25",
        className,
      )}
    >
      RL
    </div>
  );
}
