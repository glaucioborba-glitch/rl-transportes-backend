"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PessoaAutorizadaRow | null>(null);
  const [revokeRow, setRevokeRow] = useState<PessoaAutorizadaRow | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuId) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuId]);

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
                    <div className="relative inline-block text-left" ref={menuId === row.id ? menuRef : undefined}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Ações"
                        onClick={() => setMenuId((id) => (id === row.id ? null : row.id))}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      {menuId === row.id ? (
                        <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border border-white/10 bg-[#12151a] py-1 shadow-xl">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                            onClick={() => {
                              setMenuId(null);
                              setEditRow(row);
                            }}
                          >
                            <Pencil className="h-4 w-4 shrink-0" />
                            Editar permissões
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                            onClick={() => {
                              setMenuId(null);
                              setRevokeRow(row);
                            }}
                          >
                            <ShieldOff className="h-4 w-4 shrink-0" />
                            Revogar acesso
                          </button>
                        </div>
                      ) : null}
                    </div>
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
        pessoa={editRow}
        open={Boolean(editRow)}
        onClose={() => setEditRow(null)}
        onSaved={onChanged}
      />
      <PessoaRevokeDialog
        pessoa={revokeRow}
        open={Boolean(revokeRow)}
        onClose={() => setRevokeRow(null)}
        onRevoked={onChanged}
      />
    </>
  );
}
