import type { ReactNode } from "react";
import { AogShell } from "@/components/aog/aog-shell";

export default function AogLayout({ children }: { children: ReactNode }) {
  return <AogShell>{children}</AogShell>;
}
