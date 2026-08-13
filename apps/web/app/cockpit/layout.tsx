import { IntranetShell } from "@/components/intranet/intranet-shell";

export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return <IntranetShell>{children}</IntranetShell>;
}
