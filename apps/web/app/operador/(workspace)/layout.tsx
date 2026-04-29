import { OperadorHeader } from "@/components/operador/operador-header";

export default function OperadorWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080a0d] text-slate-100">
      <OperadorHeader />
      {children}
    </div>
  );
}
