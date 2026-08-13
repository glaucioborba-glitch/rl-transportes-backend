import { Building2 } from "lucide-react";

export function ClientesEmptyState() {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
      <Building2 className="h-12 w-12 text-muted-foreground/30" />
      <p className="text-lg text-muted-foreground">Nenhum cliente cadastrado.</p>
      <p className="text-sm text-muted-foreground/70">Clique em &quot;Novo Cliente&quot; para começar.</p>
    </div>
  );
}

export function ClientesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-48 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  );
}
