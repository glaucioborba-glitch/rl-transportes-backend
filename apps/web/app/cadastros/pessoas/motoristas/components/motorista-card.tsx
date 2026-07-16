"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  FileText,
  IdCard,
  Truck,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CadastrosMotoristaListItem } from "@/lib/api/cadastros-motoristas-client";
import { daysUntil, formatCPF, formatDate, formatPhone } from "@/lib/cadastros/formatters";

type Props = {
  motorista: CadastrosMotoristaListItem;
  canEdit: boolean;
  onEdit: () => void;
  onAuditoria: () => void;
};

export function MotoristaCard({ motorista, canEdit, onEdit, onAuditoria }: Props) {
  const diasParaVencer = motorista.cnhValidade ? daysUntil(motorista.cnhValidade) : null;
  const cnhVencida = diasParaVencer !== null && diasParaVencer < 0;
  const cnhVencendo =
    diasParaVencer !== null && diasParaVencer >= 0 && diasParaVencer <= 30;
  const cnhValida = diasParaVencer !== null && diasParaVencer > 30;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-card p-5 transition-colors hover:border-[var(--accent)]/30 ${
        cnhVencida
          ? "border-red-500/40"
          : cnhVencendo
            ? "border-amber-500/40"
            : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/10">
            <User className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-base font-bold">{motorista.nome}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Truck className="h-3 w-3" />
              {motorista.transportadora?.razaoSocial || "Sem transportadora"}
            </p>
          </div>
        </div>
        <Badge
          variant="neutral"
          className={
            motorista.ativo
              ? "border-green-500/30 bg-green-500/15 text-green-400"
              : "border-red-500/30 bg-red-500/15 text-red-400"
          }
        >
          {motorista.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">CPF</p>
          <p className="font-medium tabular-nums">{formatCPF(motorista.cpf) || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</p>
          <p className="font-medium tabular-nums">
            {motorista.celular ? formatPhone(motorista.celular) : "—"}
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-md bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IdCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              CNH: {motorista.cnhCategoria || "—"}
            </span>
          </div>
          {cnhValida ? <BadgeCheck className="h-4 w-4 text-green-400" /> : null}
          {cnhVencendo ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : null}
          {cnhVencida ? <AlertTriangle className="h-4 w-4 text-red-400" /> : null}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Válida até: {motorista.cnhValidade ? formatDate(motorista.cnhValidade) : "—"}
          </span>
          {cnhValida && diasParaVencer !== null ? (
            <span className="text-green-400">{diasParaVencer} dias restantes</span>
          ) : null}
          {cnhVencendo && diasParaVencer !== null ? (
            <span className="text-amber-400">⚠ Vence em {diasParaVencer} dias</span>
          ) : null}
          {cnhVencida && diasParaVencer !== null ? (
            <span className="text-red-400">
              ⛔ Vencida há {Math.abs(diasParaVencer)} dias
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{motorista.viagensMes || 0} viagem(ns) este mês</span>
        <span className="text-muted-foreground/50">·</span>
        <span>
          Última: {motorista.ultimaViagem ? formatDate(motorista.ultimaViagem) : "—"}
        </span>
      </div>

      {cnhVencida ? (
        <div className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">
          <AlertTriangle className="h-3 w-3" />
          CNH vencida — motorista BLOQUEADO no Gate CPO
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
