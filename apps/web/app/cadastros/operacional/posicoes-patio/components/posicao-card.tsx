import { AlertCircle, Box, Lock, MapPin, Snowflake } from "lucide-react";
import type { CadastroPosicaoPatio } from "@/lib/api/cadastros-posicoes-patio-client";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  LIVRE: { label: "Livre", className: "border-green-500/30 bg-green-500/5 text-green-400", icon: MapPin },
  OCUPADO: { label: "Ocupado", className: "border-red-500/30 bg-red-500/5 text-red-400", icon: Box },
  RESERVADO: { label: "Reservado", className: "border-blue-500/30 bg-blue-500/5 text-blue-400", icon: Lock },
  BLOQUEADO: { label: "Bloqueado", className: "border-zinc-500/30 bg-zinc-500/5 text-zinc-400", icon: AlertCircle },
} as const;

type Props = {
  posicao: CadastroPosicaoPatio;
  canEdit?: boolean;
  onEdit?: () => void;
};

export function PosicaoCard({ posicao, canEdit, onEdit }: Props) {
  const status = STATUS_CONFIG[posicao.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.LIVRE;
  const StatusIcon = status.icon;

  return (
    <button
      type="button"
      onClick={canEdit ? onEdit : undefined}
      disabled={!canEdit}
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/30",
        status.className,
        !canEdit && "cursor-default",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold">{posicao.codigo}</span>
        <StatusIcon className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-1 text-xs opacity-80">
        {posicao.tomadaReefer ? <Snowflake className="h-3 w-3" /> : null}
        <span>Alt {posicao.stackAltura}</span>
        {posicao.containerAtual ? (
          <span className="truncate font-mono text-[10px]">· {posicao.containerAtual}</span>
        ) : null}
      </div>
    </button>
  );
}
