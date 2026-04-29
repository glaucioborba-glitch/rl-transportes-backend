import type { ReactNode } from "react";
import { BiHeader } from "@/components/bi/bi-header";

export function BiWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#030608] text-zinc-100">
      <BiHeader />
      <div className="mx-auto max-w-[1680px] px-3 py-6 sm:px-4">{children}</div>
    </div>
  );
}
