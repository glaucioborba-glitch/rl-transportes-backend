import { Users } from "lucide-react";

export function ColaboradoresEmptyState() {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
      <Users className="h-12 w-12 text-muted-foreground/30" />
      <p className="text-lg text-muted-foreground">Nenhum colaborador cadastrado.</p>
      <p className="text-sm text-muted-foreground/70">
        Clique em &quot;Novo Colaborador&quot; para começar.
      </p>
    </div>
  );
}

export function ColaboradoresSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-52 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  );
}
