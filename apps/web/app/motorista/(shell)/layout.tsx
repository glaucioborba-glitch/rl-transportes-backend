import type { ReactNode } from "react";
import { MotorBottomNav } from "@/components/motorista/motor-bottom-nav";

export default function MotoristaShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080a0d] pb-28">
      {children}
      <MotorBottomNav />
    </div>
  );
}