"use client";

import {
  BadgeCheck,
  Building2,
  Calendar,
  FileText,
  User,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CadastrosColaboradorListItem } from "@/lib/api/cadastros-colaboradores-client";
import { formatCPF, formatDate } from "@/lib/cadastros/formatters";

const VINCULO_LABELS: Record<string, string> = {
  CLT: "CLT",
  TERCEIRIZADO: "Terceirizado",
  ESTAGIARIO: "Estagiário",
  TEMPORARIO: "Temporário",
  PRESTADOR: "Prestador PJ",
};

const VINCULO_COLORS: Record<string, string> = {
  CLT: "border-blue-500/30 bg-blue-500/15 text-blue-400",
  TERCEIRIZADO: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  ESTAGIARIO: "border-purple-500/30 bg-purple-500/15 text-purple-400",
  TEMPORARIO: "border-cyan-500/30 bg-cyan-500/15 text-cyan-400",
  PRESTADOR: "border-zinc-500/30 bg-zinc-500/15 text-zinc-400",
};

type Props = {
  colab: CadastrosColaboradorListItem;
  canEdit: boolean;
  onEdit: () => void;
  onAuditoria: () => void;
};

export function ColaboradorCard({ colab, canEdit, onEdit, onAuditoria }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-[var(--accent)]/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/10">
            <User className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-base font-bold">{colab.nome}</p>
            <p className="text-sm text-muted-foreground">{colab.cargo || "—"}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge
            variant="neutral"
            className={VINCULO_COLORS[colab.vinculo] || VINCULO_COLORS.CLT}
          >
            {VINCULO_LABELS[colab.vinculo] || colab.vinculo}
          </Badge>
          {colab.status === "ATIVO" || colab.status === "FERIAS" ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <BadgeCheck className="h-3 w-3" />{" "}
              {colab.status === "FERIAS" ? "Férias" : "Ativo"}
            </span>
          ) : null}
          {colab.status === "AFASTADO" ? (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <UserX className="h-3 w-3" /> Afastado
            </span>
          ) : null}
          {colab.status === "INATIVO" ? (
            <span className="text-xs text-red-400">Inativo</span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Matrícula</p>
          <p className="font-medium tabular-nums">{colab.matricula || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">CPF</p>
          <p className="font-medium tabular-nums">{formatCPF(colab.cpf) || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Departamento</p>
          <p className="flex items-center gap-1 font-medium">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            {colab.departamento || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Centro de Custo</p>
          <p className="font-medium">
            {colab.centroCusto?.codigo || "—"}
            {colab.centroCusto?.nome ? ` · ${colab.centroCusto.nome}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Admissão</p>
          <p className="flex items-center gap-1 font-medium">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {formatDate(colab.dataAdmissao) || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Gestor</p>
          <p className="font-medium">{colab.gestor?.nome || "—"}</p>
        </div>
      </div>

      <div className="flex gap-2 mt-2">
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
