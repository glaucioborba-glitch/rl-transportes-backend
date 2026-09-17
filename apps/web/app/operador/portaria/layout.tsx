import type { Metadata } from "next";
import { PortariaAppHeader } from "@/components/operador/portaria/portaria-app-header";

export const metadata: Metadata = {
  title: "Portaria · RL Transportes",
  description: "Check-in mobile na portaria do terminal",
};

export default function PortariaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080a0d] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <PortariaAppHeader />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
