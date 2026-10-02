"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PORTAL_SCHEDULING_DISABLED_CLASS } from "@/lib/portal-financeiro-block";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import type { ContainerPilha, ContainerTipo } from "@/lib/patiamento/types";

const TIPO_STYLES: Record<
  ContainerTipo,
  { shell: string; label: string; accent: string }
> = {
  DRY: {
    shell: "bg-gradient-to-br from-blue-700 to-blue-900 border-blue-400/60 text-white",
    label: "DRY",
    accent: "bg-blue-500/30 text-blue-100",
  },
  REEFER: {
    shell: "bg-gradient-to-br from-slate-50 to-slate-200 border-slate-300 text-slate-900",
    label: "REEFER",
    accent: "bg-cyan-500/20 text-cyan-900",
  },
  TANK: {
    shell: "bg-gradient-to-br from-amber-600 to-amber-800 border-amber-400/60 text-white",
    label: "TANK",
    accent: "bg-amber-500/30 text-amber-100",
  },
};

export function ContainerBlock({
  container,
  noTopo,
  onAgendar,
}: {
  container: ContainerPilha;
  noTopo: boolean;
  onAgendar: () => void;
}) {
  const style = TIPO_STYLES[container.tipo];
  const bloqueadoFin = usePortalClienteAuthStore((s) => s.isBloqueadoFinanceiramente);

  return (
    <article
      className={cn(
        "relative flex w-full min-w-[11rem] max-w-[13rem] flex-col gap-2 rounded-sm border-2 px-3 py-3 shadow-lg transition-transform hover:z-10 hover:scale-[1.02]",
        style.shell,
      )}
      aria-label={`Contêiner ${container.numero}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", style.accent)}>
          {style.label}
        </span>
        {noTopo ? (
          <span className="rounded border border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-tight text-emerald-100">
            Livre para Retirada
          </span>
        ) : (
          <span className="rounded border border-orange-400/50 bg-orange-500/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-tight text-orange-100">
            Exige Remoção (Shifting)
          </span>
        )}
      </div>

      <div>
        <p className="font-mono text-sm font-bold tracking-wide md:text-base">{container.numero}</p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug opacity-90">{container.clienteFinal}</p>
      </div>

      <div className="mt-auto pt-1">
        <Button
          type="button"
          size="sm"
          variant={noTopo ? "outline" : "default"}
          disabled={bloqueadoFin}
          className={cn(
            "h-8 w-full text-xs",
            PORTAL_SCHEDULING_DISABLED_CLASS,
            noTopo
              ? "border-orange-300/40 bg-orange-950/20 text-orange-100 hover:bg-orange-900/40"
              : container.tipo === "REEFER"
                ? "bg-slate-800 text-white hover:bg-slate-700"
                : "bg-white/15 hover:bg-white/25",
          )}
          onClick={bloqueadoFin ? undefined : onAgendar}
        >
          Agendar Retirada
        </Button>
      </div>

      {/* Cantoneiras simulando ISO */}
      <span className="pointer-events-none absolute left-1 top-1 h-3 w-3 border-l-2 border-t-2 border-current opacity-40" />
      <span className="pointer-events-none absolute right-1 top-1 h-3 w-3 border-r-2 border-t-2 border-current opacity-40" />
      <span className="pointer-events-none absolute bottom-1 left-1 h-3 w-3 border-b-2 border-l-2 border-current opacity-40" />
      <span className="pointer-events-none absolute bottom-1 right-1 h-3 w-3 border-b-2 border-r-2 border-current opacity-40" />
    </article>
  );
}
