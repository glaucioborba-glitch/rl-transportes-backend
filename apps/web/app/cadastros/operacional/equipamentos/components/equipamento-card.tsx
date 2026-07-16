"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  FileText,
  Forklift,
  User,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CadastrosEquipamentoListItem } from "@/lib/api/cadastros-equipamentos-client";
import { daysUntil, formatDate } from "@/lib/cadastros/formatters";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof BadgeCheck }
> = {
  DISPONIVEL: {
    label: "Disponível",
    color: "border-green-500/30 bg-green-500/15 text-green-400",
    icon: BadgeCheck,
  },
  EM_USO: {
    label: "Em Uso",
    color: "border-blue-500/30 bg-blue-500/15 text-blue-400",
    icon: Forklift,
  },
  EM_MANUTENCAO: {
    label: "Em Manutenção",
    color: "border-red-500/30 bg-red-500/15 text-red-400",
    icon: Wrench,
  },
  INATIVO: {
    label: "Inativo",
    color: "border-zinc-500/30 bg-zinc-500/15 text-zinc-400",
    icon: AlertTriangle,
  },
};

type Props = {
  equip: CadastrosEquipamentoListItem;
  canEdit: boolean;
  onEdit: () => void;
  onAuditoria: () => void;
};

export function EquipamentoCard({ equip, canEdit, onEdit, onAuditoria }: Props) {
  const status = STATUS_CONFIG[equip.status] || STATUS_CONFIG.DISPONIVEL;
  const StatusIcon = status.icon;
  const diasManutencao = equip.proximaManutencao ? daysUntil(equip.proximaManutencao) : null;
  const manutencaoVencida = diasManutencao !== null && diasManutencao < 0;
  const manutencaoVencendo =
    diasManutencao !== null && diasManutencao >= 0 && diasManutencao <= 7;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-card p-5 transition-colors hover:border-[var(--accent)]/30 ${
        manutencaoVencida
          ? "border-red-500/40"
          : manutencaoVencendo
            ? "border-amber-500/40"
            : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)]/10">
            <Forklift className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="font-mono text-base font-bold">{equip.codigo}</p>
            <p className="text-sm text-muted-foreground">
              {equip.marca} {equip.modelo}
            </p>
          </div>
        </div>
        <Badge variant="neutral" className={status.color}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</p>
          <p className="font-medium">{equip.tipo?.replace(/_/g, " ") || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Capacidade</p>
          <p className="font-medium tabular-nums">{equip.capacidade || "—"} t</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Horímetro</p>
          <p className="font-medium tabular-nums">{equip.horimetro || 0} h</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Operador Atual</p>
          <p className="flex items-center gap-1 font-medium">
            <User className="h-3 w-3 text-muted-foreground" />
            {equip.operadorAtual?.nome || "Não atribuído"}
          </p>
        </div>
      </div>

      {manutencaoVencida ? (
        <div className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">
          <AlertTriangle className="h-3 w-3" />
          Manutenção preventiva VENCIDA há {Math.abs(diasManutencao!)} dias
        </div>
      ) : null}
      {manutencaoVencendo ? (
        <div className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          Manutenção preventiva em {diasManutencao} dias
        </div>
      ) : null}
      {equip.proximaManutencao && !manutencaoVencida && !manutencaoVencendo ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Próx. manutenção: {formatDate(equip.proximaManutencao)}
        </div>
      ) : null}

      <div className="mt-2 flex gap-2">
        {canEdit ? (
          <Button variant="outline" size="sm" onClick={onEdit} className="text-xs">
            Editar
          </Button>
        ) : null}
        <Button
          variant="link"
          size="sm"
          onClick={onAuditoria}
          className="ml-auto p-0 text-xs text-muted-foreground"
        >
          <FileText className="mr-1 inline h-3 w-3" />
          Auditoria →
        </Button>
      </div>
    </div>
  );
}
