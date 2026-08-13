"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
            className={cn(
              "relative whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "text-[var(--accent)] after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-[var(--accent)]"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            {mod.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function getModuleDefaultHref(id: IntranetModuleId): string {
  return MODULOS_INTRANET.find((m) => m.id === id)?.href ?? "/operador/dashboard";
}
