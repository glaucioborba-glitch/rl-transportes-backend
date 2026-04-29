import { SdtShell } from "@/components/sdt/sdt-shell";

export default function SdtLayout({ children }: { children: React.ReactNode }) {
  return <SdtShell>{children}</SdtShell>;
}
