import type { ReactNode } from "react";
import { FinanceiroHeader } from "@/components/financeiro/financeiro-header";

export default function FinanceiroLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <FinanceiroHeader />
      <div className="mx-auto max-w-[1400px] px-4 py-8">{children}</div>
    </div>
  );
}
