"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RlLogo } from "@/components/portal/rl-logo";

const NAV = [
  { href: "/agi/self-learning", label: "Self-learning" },
  { href: "/agi/self-correcting", label: "Self-correcting" },
  { href: "/agi/self-optimizing", label: "Self-optimizing" },
] as const;

export function AgiShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#030308] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-violet-500/25 bg-[#050510]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/agi/self-learning" className="flex items-center gap-3">
            <RlLogo />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300/90">AGI‑OPS</p>
              <p className="text-sm font-semibold text-white">Autonomous general intelligence · operations</p>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(({ href, label }) => {
              const root = href === "/agi/self-learning" && (pathname === href || pathname === "/agi");
              const isOn = root || pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                    isOn
                      ? "bg-violet-500/25 text-white ring-1 ring-violet-400/40 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                      : "text-zinc-500 hover:bg-white/5 hover:text-violet-200",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-[1920px] px-3 py-5 sm:px-4">{children}</div>
    </div>
  );
}
