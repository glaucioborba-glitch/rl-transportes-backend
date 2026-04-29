import type { ReactNode } from "react";
import { SsmaHeader } from "@/components/ssma/ssma-header";

export function SsmaWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#040302] text-zinc-100">
      <SsmaHeader />
      <div className="mx-auto max-w-[1680px] px-3 py-6 sm:px-4">{children}</div>
    </div>
  );
}
