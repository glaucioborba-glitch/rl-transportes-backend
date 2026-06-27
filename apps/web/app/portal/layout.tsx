import type { ReactNode } from "react";
import { PortalLayoutClient } from "./portal-layout-client";

/** Server layout: evita segmento 100% client-only (chunks/CSS do App Router mais estáveis em dev). */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalLayoutClient>{children}</PortalLayoutClient>;
}
