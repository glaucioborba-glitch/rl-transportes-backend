"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RlLogo } from "@/components/portal/rl-logo";

const NAV = [
  { href: "/ai-console/operacional", label: "Operacional" },
  { href: "/ai-console/financeiro", label: "Financeiro" },
  { href: "/ai-console/estrategico", label: "Estratégico" },
] as const;

export function AiConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#070510] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-violet-500/25 bg-[#0a0618]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/ai-console/operacional" className="flex items-center gap-3">
            <RlLogo />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300/90">AI Console</p>
              <p className="text-sm font-semibold text-white">Copiloto corporativo · heurísticas locais</p>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(({ href, label }) => {
              const onOper = href === "/ai-console/operacional" && (pathname === href || pathname === "/ai-console");
              const isOn = onOper || pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide",
                    isOn ? "bg-violet-600/30 text-violet-100 ring-1 ring-violet-400/35" : "text-zinc-500 hover:bg-white/5 hover:text-white",
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
