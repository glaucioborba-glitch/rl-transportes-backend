"use client";

import Link from "next/link";
import { Building2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CadastrosClienteFormData } from "@/lib/api/cadastros-clientes-client";
import { formatCNPJ, formatCEP, formatPhone } from "@/lib/cadastros/formatters";

type Props = {
  cliente: CadastrosClienteFormData;
  clienteId: string;
};

export function ClienteDetail({ cliente, clienteId }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--accent)]/10">
            <Building2 className="h-6 w-6 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{cliente.razaoSocial}</h2>
            <p className="text-sm text-muted-foreground">{cliente.nomeFantasia || "—"}</p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">{formatCNPJ(cliente.cnpj)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={cliente.ativo ? "aprovado" : "rejeitado"}>
            {cliente.ativo ? "Ativo" : "Inativo"}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cadastros/pessoas/clientes/${clienteId}/auditoria`}>
              <History className="mr-1.5 h-3.5 w-3.5" />
              Auditoria
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">E-mail</p>
          <p>{cliente.email || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Telefone</p>
          <p className="tabular-nums">{formatPhone(cliente.telefone) || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">CEP</p>
          <p className="tabular-nums">{formatCEP(cliente.cep) || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cidade/UF</p>
          <p>
            {cliente.cidade}/{cliente.uf}
          </p>
        </div>
      </div>
    </div>
  );
}
