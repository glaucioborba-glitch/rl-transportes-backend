/** Páginas do Gate CPO — sem o cockpit antigo (Dashboard/Fila/Despacho). */
export default function GateWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}
