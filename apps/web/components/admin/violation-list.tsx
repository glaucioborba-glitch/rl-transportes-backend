import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViolationItem = {
  id: string;
  titulo: string;
  detalhe: string;
  severidade: "alta" | "media" | "baixa";
  fonte: string;
};

export function ViolationList({ items }: { items: ViolationItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-emerald-400/90">Nenhuma violação listada no recorte.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((v) => (
        <li
          key={v.id}
          className={cn(
            "flex gap-3 rounded-xl border px-3 py-2",
            v.severidade === "alta" && "border-red-500/35 bg-red-500/5",
            v.severidade === "media" && "border-amber-500/30 bg-amber-500/5",
            v.severidade === "baixa" && "border-white/10 bg-zinc-900/40",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              v.severidade === "alta" && "text-red-400",
              v.severidade === "media" && "text-amber-400",
              v.severidade === "baixa" && "text-zinc-500",
            )}
          />
          <div>
            <p className="text-sm font-semibold text-zinc-100">{v.titulo}</p>
            <p className="text-xs text-zinc-500">{v.detalhe}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-sky-600">{v.fonte}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
