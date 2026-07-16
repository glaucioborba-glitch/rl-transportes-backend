"use client";

import {
  AlertTriangle,
  BadgeCheck,
  FileText,
  Truck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CadastrosTransportadoraListItem } from "@/lib/api/cadastros-transportadoras-client";
import { daysUntil, formatCNPJ, formatDate, formatPhone } from "@/lib/cadastros/formatters";

type Props = {
  transp: CadastrosTransportadoraListItem;
  canEdit: boolean;
  onEdit: () => void;
  onAuditoria: () => void;
};

export function TransportadoraCard({ transp, canEdit, onEdit, onAuditoria }: Props) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = transp.rntrcValidade
    ? new Date(`${transp.rntrcValidade}T12:00:00`)
    : null;
  const dias = validade ? daysUntil(transp.rntrcValidade!) : null;
  const rntrcValido = dias !== null && dias >= 0;
  const rntrcVencendo = dias !== null && dias >= 0 && dias <= 30;
  const rntrcVencido = dias !== null && dias < 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-[var(--accent)]/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)]/10">
            <Truck className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-base font-bold">{transp.razaoSocial}</p>
            <p className="text-sm text-muted-foreground">{transp.nomeFantasia || "—"}</p>
          </div>
        </div>
        <Badge
          variant="neutral"
          className={
            transp.ativo
              ? "border-green-500/30 bg-green-500/15 text-green-400"
              : "border-red-500/30 bg-red-500/15 text-red-400"
          }
        >
          {transp.ativo ? "Ativa" : "Inativa"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">CNPJ</p>
          <p className="font-medium tabular-nums">{formatCNPJ(transp.cnpj)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">RNTRC</p>
          <p className="flex items-center gap-1 font-medium tabular-nums">
            {transp.rntrc || "—"}
            {rntrcValido && !rntrcVencendo ? (
              <BadgeCheck className="h-3.5 w-3.5 text-green-400" />
            ) : null}
            {rntrcVencendo ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> : null}
            {rntrcVencido && transp.rntrcValidade ? (
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Cidade/UF</p>
          <p className="font-medium">
            {transp.cidade || "—"}/{transp.uf || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</p>
          <p className="font-medium tabular-nums">
            {transp.telefone ? formatPhone(transp.telefone) : "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {transp.motoristasAtivos || 0} motorista(s)
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="flex items-center gap-1">
          <Truck className="h-3.5 w-3.5" />
          {transp.frotaTotal || 0} veículo(s)
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          {transp.solicitacoesMes || 0} solic. este mês
        </span>
      </div>

      {rntrcVencendo && transp.rntrcValidade ? (
        <div className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          RNTRC vence em {formatDate(transp.rntrcValidade)} ({dias} dias)
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
          Auditoria →
        </Button>
      </div>
    </div>
  );
}
