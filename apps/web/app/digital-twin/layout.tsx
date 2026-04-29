import type { ReactNode } from "react";
import { TwinShell } from "@/components/digital-twin/twin-shell";

export default function DigitalTwinLayout({ children }: { children: ReactNode }) {
  return <TwinShell>{children}</TwinShell>;
}
