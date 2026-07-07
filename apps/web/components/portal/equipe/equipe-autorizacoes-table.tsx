"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import type { PessoaAutorizadaRow } from "@/lib/api/portal-client";
import { PessoaEditDialog } from "./pessoa-edit-dialog";
import { PessoaRevokeDialog } from "./pessoa-revoke-dialog";

type EquipeAutorizacoesTableProps = {
  rows: PessoaAutorizadaRow[];
  podeGerenciar: boolean;
  pessoaSessaoId?: string | null;
  onChanged: () => void;
};

function documentoLabel(row: PessoaAutorizadaRow): string {
  if (row.cpf) return formatCpfBr(row.cpf);
  return "—";
}

export function EquipeAutorizacoesTable({
  rows,
  podeGerenciar,
  pessoaSessaoId,
  onChanged,
}: EquipeAutorizacoesTableProps) {
  const [modalEdicao, setModalEdicao] = useState<PessoaAutorizadaRow | null>(null);
  const [modalRevogacao, setModalRevogacao] = useState<PessoaAutorizadaRow | null>(null);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum operador cadastrado.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="hidden sm:table-cell">Documento</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const ativo = row.ativo !== false;
            const isSelf = pessoaSessaoId === row.id;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-white">{row.nome}</TableCell>
                <TableCell className="hidden font-mono text-xs sm:table-cell">
                  {documentoLabel(row)}
                </TableCell>
                <TableCell className="max-w-[12rem] truncate text-slate-300">{row.email}</TableCell>
                <TableCell>
                  {ativo ? (
                    <Badge variant="aprovado">Ativo</Badge>
                  ) : (
                    <Badge variant="neutral">Inativo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {podeGerenciar && ativo && !isSelf ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setModalEdicao(row)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar Permissões
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setModalRevogacao(row)}
                          className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Revogar Acesso
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <PessoaEditDialog
        pessoa={modalEdicao}
        open={Boolean(modalEdicao)}
        onClose={() => setModalEdicao(null)}
        onSaved={onChanged}
      />
      <PessoaRevokeDialog
        pessoa={modalRevogacao}
        open={Boolean(modalRevogacao)}
        onClose={() => setModalRevogacao(null)}
        onRevoked={onChanged}
      />
    </>
  );
}
