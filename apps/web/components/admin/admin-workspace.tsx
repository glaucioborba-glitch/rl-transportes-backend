import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin/admin-header";

export function AdminWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050810] text-zinc-100 antialiased">
      <AdminHeader />
      <div className="mx-auto max-w-[1600px] px-4 py-8">{children}</div>
    </div>
  );
}
