"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { clearMotoristaSessionCookie } from "@/lib/auth-motorista-cookie";
import { useMotoristaAuthStore } from "@/stores/motorista-auth-store";
import { cn } from "@/lib/utils";

const links = [
  { href: "/motorista/checkin", label: "Check-in" },
  { href: "/motorista/senha", label: "Senha" },
  { href: "/motorista/fila", label: "Fila" },
  { href: "/motorista/tracking", label: "Tracking" },
];

export function MobileHeader({ title }: { title: string }) {
  const router = useRouter();
  const email = useMotoristaAuthStore((s) => s.user?.email ?? "");
  const clear = useMotoristaAuthStore((s) => s.clear);
  const [open, setOpen] = useState(false);

  function logout() {
    clear();
    clearMotoristaSessionCookie();
    router.replace("/motorista/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0d12]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-3 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-white">{title}</h1>
          {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-rose-300"
            aria-label="Sair"
            onClick={() => logout()}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
      <nav
        className={cn(
          "border-t border-white/5 bg-black/50 px-2 py-2 transition-all",
          open ? "block" : "hidden",
        )}
      >
        <ul className="grid grid-cols-2 gap-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex min-h-12 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white hover:bg-white/15"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
