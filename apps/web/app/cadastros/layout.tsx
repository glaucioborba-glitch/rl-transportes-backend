"use client";

import type { ReactNode } from "react";
import { IntranetShell } from "@/components/intranet/intranet-shell";
import { CadastrosGuard } from "@/components/cadastros/cadastros-guard";

export default function CadastrosLayout({ children }: { children: ReactNode }) {
  return (
    <CadastrosGuard>
      <IntranetShell>{children}</IntranetShell>
    </CadastrosGuard>
  );
}
