"use client";

import Link from "next/link";
import { History, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CadastrosColaboradorFormData } from "@/lib/api/cadastros-colaboradores-client";
import { formatCPF, formatDate } from "@/lib/cadastros/formatters";

const VINCULO_LABELS: Record<string, string> = {
  CLT: "CLT",
  TERCEIRIZADO: "Terceirizado",
  ESTAGIARIO: "Estagiário",
  TEMPORARIO: "Temporário",
  PRESTADOR: "Prestador PJ",
};

type Props = {
  colaborador: CadastrosColaboradorFormData & {
    gestor?: { id: string; nome: string } | null;
    centroCusto?: { codigo: string; nome: string } | null;
  };
  colaboradorId: string;
};

export function ColaboradorDetail({ colaborador, colaboradorId }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/10">
            <User className="h-6 w-6 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{colaborador.nome}</h2>
            <p className="text-sm text-muted-foreground">{colaborador.cargo || "—"}</p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {formatCPF(colaborador.cpf)}
              {colaborador.matricula ? ` · Mat. ${colaborador.matricula}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{VINCULO_LABELS[colaborador.vinculo] ?? colaborador.vinculo}</Badge>
          <Badge variant={colaborador.status === "INATIVO" ? "rejeitado" : "aprovado"}>
            {colaborador.status}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cadastros/pessoas/colaboradores/${colaboradorId}/auditoria`}>
              <History className="mr-1.5 h-3.5 w-3.5" />
              Auditoria
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Admissão</p>
          <p>{formatDate(colaborador.dataAdmissao) || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Departamento</p>
          <p>{colaborador.departamento || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Gestor</p>
          <p>{colaborador.gestor?.nome || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Centro de Custo</p>
          <p>
            {colaborador.centroCusto?.codigo || "—"}
            {colaborador.centroCusto?.nome ? ` · ${colaborador.centroCusto.nome}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
