import type { ReactNode } from "react";
import { RhHeader, RhSideNav } from "@/components/rh/rh-header";

export function RhWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#06080c] text-zinc-100">
      <RhHeader />
      <div className="mx-auto flex max-w-[1400px] flex-col sm:flex-row">
        <RhSideNav />
        <main className="min-h-[60vh] flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
