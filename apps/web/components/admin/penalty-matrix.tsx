import { cn } from "@/lib/utils";

export type PenaltyRow = {
  id: string;
  tipo: string;
  severidade: "leve" | "moderada" | "grave";
  descricao: string;
  valorEstimado: string;
};

const SEV: Record<PenaltyRow["severidade"], string> = {
  leve: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  moderada: "bg-amber-500/15 text-amber-100 ring-amber-400/30",
  grave: "bg-red-500/20 text-red-100 ring-red-500/40",
};

export function PenaltyMatrix({ rows }: { rows: PenaltyRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-[640px] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-zinc-900/95 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Severidade</th>
            <th className="px-3 py-2">Regra / divergência</th>
            <th className="px-3 py-2">Estimativa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="px-3 py-2 font-medium text-zinc-200">{r.tipo}</td>
              <td className="px-3 py-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1", SEV[r.severidade])}>
                  {r.severidade}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-400">{r.descricao}</td>
              <td className="px-3 py-2 font-mono text-emerald-300/90">{r.valorEstimado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
