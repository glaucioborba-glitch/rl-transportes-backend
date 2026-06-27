import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { ResilienceCircuitBanner } from "@/components/resilience/resilience-circuit-banner";

export function AdminWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050810] text-zinc-100 antialiased">
      <AdminHeader />
      <ResilienceCircuitBanner />
      <div className="mx-auto max-w-[1600px] px-4 py-8">{children}</div>
    </div>
  );
}
