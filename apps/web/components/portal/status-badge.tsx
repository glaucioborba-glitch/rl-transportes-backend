import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { solicitacaoStatusLabel, solicitacaoStatusVariant } from "@/lib/portal-status";

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={solicitacaoStatusVariant(status)} className="font-normal normal-case">
      {solicitacaoStatusLabel(status)}
    </Badge>
  );
}

export function RawStatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: ComponentProps<typeof Badge>["variant"];
}) {
  return (
    <Badge variant={variant} className="font-normal normal-case">
      {label}
    </Badge>
  );
}
