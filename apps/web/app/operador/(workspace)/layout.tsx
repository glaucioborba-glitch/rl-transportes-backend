import { IntranetShell } from "@/components/intranet/intranet-shell";

export default function OperadorWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <IntranetShell flush>{children}</IntranetShell>;
}
