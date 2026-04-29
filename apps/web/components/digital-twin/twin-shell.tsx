"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RlLogo } from "@/components/portal/rl-logo";

const NAV = [
  { href: "/digital-twin/terminal", label: "Terminal 2D" },
  { href: "/digital-twin/3d", label: "Yard 3D" },
  { href: "/digital-twin/what-if", label: "What-If" },
] as const;

export function TwinShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#030510] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-cyan-500/20 bg-[#040816]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/digital-twin/terminal" className="flex items-center gap-3">
            <RlLogo />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400/90">Digital Twin</p>
              <p className="text-sm font-semibold text-white">Terminal Virtual · TOC/NOC</p>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(({ href, label }) => {
              const active2d = href === "/digital-twin/terminal" && (pathname === href || pathname === "/digital-twin");
              const isOn = active2d || pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide",
                    isOn ? "bg-cyan-600/25 text-cyan-200 ring-1 ring-cyan-500/35" : "text-zinc-500 hover:bg-white/5 hover:text-white",
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
