"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  OPERACIONAL_TABS,
  OperacionalBreadcrumb,
  OperacionalTabs,
} from "./components/operacional-tabs";

export default function OperacionalCadastrosLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = OPERACIONAL_TABS.find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  )?.label;

  return (
    <div className="space-y-6">
      <div>
        {current ? <OperacionalBreadcrumb current={current} /> : null}
        <OperacionalTabs />
      </div>
      {children}
    </div>
  );
}
