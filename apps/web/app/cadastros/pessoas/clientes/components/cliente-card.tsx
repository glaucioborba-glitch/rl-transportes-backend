"use client";

import { Building2, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CadastrosClienteListItem } from "@/lib/api/cadastros-clientes-client";
import { formatCNPJ, formatPhone } from "@/lib/cadastros/formatters";

type Props = {
  cliente: CadastrosClienteListItem;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onAuditoria: () => void;
  onInativar?: () => void;
};

export function ClienteCard({
  cliente,
  canEdit,
  canDelete,
  onEdit,
  onAuditoria,
  onInativar,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-[var(--accent)]/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)]/10">
            <Building2 className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-base font-bold">{cliente.razaoSocial}</p>
            <p className="text-sm text-muted-foreground">{cliente.nomeFantasia || "—"}</p>
          </div>
        </div>
        <Badge
          variant={cliente.ativo ? "aprovado" : "rejeitado"}
          className={
            cliente.ativo
              ? "border-green-500/30 bg-green-500/15 text-green-400"
              : "border-red-500/30 bg-red-500/15 text-red-400"
          }
        >
          {cliente.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">CNPJ</p>
          <p className="font-medium tabular-nums">{formatCNPJ(cliente.cnpj)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">IE</p>
          <p className="font-medium tabular-nums">{cliente.ie || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</p>
          <p className="font-medium tabular-nums">{formatPhone(cliente.telefone) || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Cidade/UF</p>
          <p className="font-medium">
            {cliente.cidade}/{cliente.uf || "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <span>{cliente.contratosAtivos || 0} contrato(s) ativo(s)</span>
        <span className="text-muted-foreground/50">·</span>
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>{cliente.solicitacoes || 0} solicitação(ões) no Gate</span>
      </div>

      <div className="mt-2 flex gap-2">
        {canEdit ? (
          <Button variant="outline" size="sm" onClick={onEdit} className="text-xs">
            Editar
          </Button>
        ) : null}
        {canDelete && cliente.ativo && onInativar ? (
          <Button variant="outline" size="sm" onClick={onInativar} className="text-xs text-red-400">
            Inativar
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
