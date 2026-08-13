"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [{ href: "/super-admin", label: "Terminais SaaS" }];

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-violet-500/20 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-400">RL Transportes SaaS</p>
            <h1 className="text-lg font-semibold text-white">Super Admin</h1>
          </div>
          <nav className="flex gap-2">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "rounded-md bg-violet-600 px-3 py-1.5 text-sm text-white"
                      : "rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
