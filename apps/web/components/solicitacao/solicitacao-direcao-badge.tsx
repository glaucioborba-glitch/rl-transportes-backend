import { cn } from "@/lib/utils";
import { direcaoSolicitacao } from "@/lib/solicitacao-intent";

const PILL =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide";

export function SolicitacaoDirecaoBadge({
  intent,
  className,
}: {
  intent?: string | null;
  className?: string;
}) {
  const direcao = direcaoSolicitacao(intent);
  if (direcao === "ENTRADA") {
    return (
      <span
        className={cn(
          PILL,
          "border-green-500/40 bg-green-500/15 uppercase text-green-400",
          className,
        )}
      >
        ENTRADA
      </span>
    );
  }
  if (direcao === "SAIDA") {
    return (
      <span className={cn(PILL, "border-orange-500/40 bg-orange-500/15 text-orange-400", className)}>
        Saída
      </span>
    );
  }
  return null;
}
