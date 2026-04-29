import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BiSection({
  id,
  title,
  subtitle,
  children,
  className,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-2xl border border-white/10 bg-[#0a1018]/90 p-4 shadow-xl sm:p-5", className)}>
      <div className="mb-4 border-l-4 border-cyan-500 pl-3">
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
