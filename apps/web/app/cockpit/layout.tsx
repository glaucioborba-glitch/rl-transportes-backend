import { OperadorHeader } from "@/components/operador/operador-header";

export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#06080c] text-slate-100">
      <OperadorHeader />
      {children}
    </div>
  );
}
