import type { ReactNode } from "react";
import { RhWorkspace } from "@/components/rh/rh-workspace";

export default function RhLayout({ children }: { children: ReactNode }) {
  return <RhWorkspace>{children}</RhWorkspace>;
}
