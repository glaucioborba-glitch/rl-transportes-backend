"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RlLogo } from "@/components/portal/rl-logo";

const NAV = [
  { href: "/aog/core", label: "Governance core" },
  { href: "/aog/disciplina", label: "Disciplina" },
  { href: "/aog/self-regulation", label: "Self-regulation" },
] as const;

export function AogShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#050608] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-slate-600/40 bg-[#060a10]/97 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/aog/core" className="flex items-center gap-3">
            <RlLogo />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-300/90">AOG</p>
              <p className="text-sm font-semibold text-white">Autonomous Operations Governance</p>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(({ href, label }) => {
              const root = href === "/aog/core" && (pathname === href || pathname === "/aog");
              const isOn = root || pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide",
                    isOn ? "bg-white/10 text-white ring-1 ring-slate-400/50" : "text-zinc-500 hover:bg-white/5 hover:text-white",
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
