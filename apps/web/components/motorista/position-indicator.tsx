"use client";

import { cn } from "@/lib/utils";

/** ahead = quantidade de solicitações antes da sua na fila; inQueue = sua OS está nessa fila */
export function PositionIndicator({
  ahead,
  totalInQueue,
  inQueue,
}: {
  ahead: number;
  totalInQueue: number;
  inQueue: boolean;
}) {
  const pct =
    totalInQueue > 0 && inQueue ? Math.min(100, Math.round(((totalInQueue - ahead) / totalInQueue) * 100)) : 0;
  const yourTurn = inQueue && ahead <= 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-slate-300">
        <span>Na fila</span>
        <span className="font-mono font-bold text-white">
          {!inQueue ? "—" : yourTurn ? "Sua vez!" : `${ahead} na frente`}
        </span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            yourTurn ? "bg-emerald-500" : pct > 66 ? "bg-amber-400" : "bg-sky-500",
          )}
          style={{ width: `${inQueue ? pct : 0}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        {inQueue
          ? `${Math.min(ahead, totalInQueue)} solicitação(ões) antes · total ${totalInQueue}`
          : "Fora desta fila ou fila indisponível"}
      </p>
    </div>
  );
}
