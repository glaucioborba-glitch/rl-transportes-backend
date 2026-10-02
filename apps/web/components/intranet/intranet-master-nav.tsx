"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquareArrowOutUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MODULOS_INTRANET,
  type IntranetModuleId,
  visibleIntranetModules,
} from "@/lib/intranet/intranet-nav-config";
import { resolveIntranetModule } from "@/lib/intranet/resolve-intranet-module";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type Props = {
  activeModule?: IntranetModuleId;
};

export function IntranetMasterNav({ activeModule }: Props) {
  const pathname = usePathname();
  const role = useStaffAuthStore((s) => s.user?.role ?? "");
  const modules = visibleIntranetModules(role);
  const current = activeModule ?? resolveIntranetModule(pathname);

  return (
    <nav className="flex flex-1 flex-wrap items-center gap-1 overflow-x-auto">
      {modules.map((mod) => {
        const active = mod.id === current;
        return (
          <Link
            key={mod.id}
            href={mod.href}
            target={mod.openInNewTab ? "_blank" : undefined}
            rel={mod.openInNewTab ? "noopener noreferrer" : undefined}
            title={mod.openInNewTab ? `${mod.label} — abre em nova aba` : undefined}
            className={cn(
              "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "text-[var(--accent)] after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-[var(--accent)]"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            {mod.label}
            {mod.openInNewTab ? (
              <SquareArrowOutUpRight className="h-3 w-3 opacity-70" aria-hidden />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function getModuleDefaultHref(id: IntranetModuleId): string {
  return MODULOS_INTRANET.find((m) => m.id === id)?.href ?? "/operador/dashboard";
}
