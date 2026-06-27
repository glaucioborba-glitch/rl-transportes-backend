import type { ReactNode } from "react";
import { AdminWorkspace } from "@/components/admin/admin-workspace";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <AdminWorkspace>{children}</AdminWorkspace>;
}
