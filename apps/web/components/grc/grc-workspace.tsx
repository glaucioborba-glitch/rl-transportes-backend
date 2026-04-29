import type { ReactNode } from "react";
import { GrcHeader } from "@/components/grc/grc-header";

export function GrcWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#03040a] text-zinc-100">
      <GrcHeader />
      <div className="mx-auto max-w-[1680px] px-3 py-6 sm:px-4">{children}</div>
    </div>
  );
}
