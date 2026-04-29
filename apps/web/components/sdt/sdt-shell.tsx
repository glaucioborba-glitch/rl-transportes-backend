"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RlLogo } from "@/components/portal/rl-logo";

const NAV = [
  { href: "/sdt/decision-engine", label: "Decision engine" },
  { href: "/sdt/autopilot", label: "Autopilot" },
  { href: "/sdt/estrategico", label: "Estratégico" },
] as const;

export function SdtShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#020403] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-emerald-500/20 bg-[#030806]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/sdt/decision-engine" className="flex items-center gap-3">
            <RlLogo />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-400/90">Self-driving terminal</p>
              <p className="text-sm font-semibold text-white">Orquestração cognitiva · simulação</p>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(({ href, label }) => {
              const root = href === "/sdt/decision-engine" && (pathname === href || pathname === "/sdt");
              const isOn = root || pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide",
                    isOn ? "bg-emerald-600/25 text-emerald-100 ring-1 ring-emerald-500/35" : "text-zinc-500 hover:bg-white/5 hover:text-white",
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
