"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, ListOrdered, MapPin, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/motorista/checkin", label: "Check-in", Icon: ClipboardList },
  { href: "/motorista/senha", label: "Senha", Icon: QrCode },
  { href: "/motorista/fila", label: "Fila", Icon: ListOrdered },
  { href: "/motorista/tracking", label: "Tracking", Icon: MapPin },
];

export function MotorBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0a0d12]/95 backdrop-blur-md safe-area-pb">
      <ul className="mx-auto flex max-w-lg justify-around px-1 py-2">
        {NAV.map(({ href, label, Icon }) => {
          const on = pathname === href || (href !== "/motorista/checkin" && pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex min-w-[4.25rem] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold sm:text-xs",
                  on ? "text-[var(--accent)]" : "text-slate-500",
                )}
              >
                <Icon className={cn("h-7 w-7", on && "text-[var(--accent)]")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
