"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ADVANCED_MODULES,
  MODULE_META,
  SIDEBAR_CONFIG,
  canAccessIntranetSidebarItem,
  type IntranetModuleId,
} from "@/lib/intranet/intranet-nav-config";
import { NotificationBadge } from "@/components/ui/notification-badge";
import { useIntranetSidebarBadges } from "@/hooks/use-intranet-sidebar-badges";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type Props = {
  moduleId: IntranetModuleId;
};

export function IntranetSidebar({ moduleId }: Props) {
  const pathname = usePathname();
  const role = useStaffAuthStore((s) => s.user?.role ?? "");
  const meta = MODULE_META[moduleId];
  const items = (SIDEBAR_CONFIG[moduleId] ?? []).filter((item) =>
    canAccessIntranetSidebarItem(role, item),
  );
  const { resolveBadge } = useIntranetSidebarBadges(moduleId);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const showAdvanced = role === "ADMIN" || role === "SUPER_ADMIN";

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-white/10 bg-[#06080c]">
      <div className="border-b border-white/10 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--accent)]">
          {meta.title}
        </h2>
        <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin" &&
              item.href !== "/bi" &&
              item.href !== "/grc" &&
              item.href !== "/ssma" &&
              item.href !== "/cockpit" &&
              item.href !== "/rh" &&
              item.href !== "/cadastros" &&
              pathname.startsWith(`${item.href}/`));
          const badge = resolveBadge(item.badgeKey);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]"
                  : "text-muted-foreground hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.label}</span>
                {item.description ? (
                  <span className="block truncate text-[10px] font-normal text-zinc-500">
                    {item.description}
                  </span>
                ) : null}
              </span>
              {badge ? <NotificationBadge count={badge} /> : null}
            </Link>
          );
        })}
      </nav>

      {showAdvanced ? (
        <div className="border-t border-white/10">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-xs text-muted-foreground hover:bg-white/5 hover:text-white"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Módulos avançados</span>
            {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {advancedOpen ? (
            <div className="max-h-48 space-y-2 overflow-y-auto px-3 pb-3">
              {ADVANCED_MODULES.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block rounded px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-white/10 p-3 text-xs text-muted-foreground">
        RL Terminal v2.0 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
