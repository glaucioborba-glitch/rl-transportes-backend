import type { ReactNode } from "react";
import { AgiShell } from "@/components/agi/agi-shell";

export default function AgiLayout({ children }: { children: ReactNode }) {
  return <AgiShell>{children}</AgiShell>;
}
