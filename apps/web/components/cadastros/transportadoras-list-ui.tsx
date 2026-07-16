import { Truck } from "lucide-react";

export function TransportadorasEmptyState() {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
      <Truck className="h-12 w-12 text-muted-foreground/30" />
      <p className="text-lg text-muted-foreground">Nenhuma transportadora cadastrada.</p>
      <p className="text-sm text-muted-foreground/70">
        Clique em &quot;Nova Transportadora&quot; para começar.
      </p>
    </div>
  );
}

export function TransportadorasSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-52 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  );
}
