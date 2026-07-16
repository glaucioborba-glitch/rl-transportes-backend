import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portaria · RL Transportes",
  description: "Check-in mobile na portaria do terminal",
};

export default function PortariaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080a0d] text-slate-100">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
