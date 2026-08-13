import type { ReactNode } from "react";
import { PortalLayoutClient } from "@/app/portal/portal-layout-client";

/** Layout do segmento /cliente/portal — reutiliza shell autenticado do portal CX. */
export default function ClientePortalLayout({ children }: { children: ReactNode }) {
  return <PortalLayoutClient>{children}</PortalLayoutClient>;
}
