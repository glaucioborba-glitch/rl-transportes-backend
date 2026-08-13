import type { ReactNode } from "react";
import { IntranetShell } from "@/components/intranet/intranet-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <IntranetShell>{children}</IntranetShell>;
}
