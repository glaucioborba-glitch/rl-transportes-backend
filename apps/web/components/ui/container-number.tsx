import { cn } from "@/lib/utils";
import { formatContainerISO } from "@/utils/containerFormatter";

interface ContainerNumberProps {
  /** Número bruto do contêiner, pode vir com ou sem formatação */
  value: string;
  /** Se true, mostra o label "CONTÊINER" acima do número */
  showLabel?: boolean;
  /** Tamanho da fonte: 'sm' para cards compactos, 'md' (default) para padrão, 'lg' para destaque máximo */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Formata o número do contêiner no padrão ISO 6346: XXXX 111111-0
 * Aceita entrada com ou sem espaços/hífens e normaliza para o padrão.
 */
export function formatContainerNumber(raw: string): string {
  if (!raw?.trim() || raw.trim() === "—") return raw?.trim() || "—";
  const formatted = formatContainerISO(raw);
  return formatted || raw.trim();
}

export function ContainerNumber({
  value,
  showLabel = true,
  size = "md",
  className,
}: ContainerNumberProps) {
  const formatted = formatContainerNumber(value);

  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {showLabel ? (
        <p className="mb-0.5 text-xs uppercase tracking-wider text-muted-foreground">Contêiner</p>
      ) : null}
      <p
        className={cn(
          "font-bold tabular-nums tracking-wide text-primary",
          sizeClasses[size],
        )}
      >
        {formatted}
      </p>
    </div>
  );
}
