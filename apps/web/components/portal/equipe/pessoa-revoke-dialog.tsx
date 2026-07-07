"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError, portalRevogarPessoaAutorizada, type PessoaAutorizadaRow } from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";

type PessoaRevokeDialogProps = {
  pessoa: PessoaAutorizadaRow | null;
  open: boolean;
  onClose: () => void;
  onRevoked: () => void;
};

export function PessoaRevokeDialog({ pessoa, open, onClose, onRevoked }: PessoaRevokeDialogProps) {
  const [saving, setSaving] = useState(false);

  async function revogarAcesso() {
    if (!pessoa) return;
    setSaving(true);
    try {
      await portalRevogarPessoaAutorizada(pessoa.id);
      toast.success("Acesso revogado.");
      onRevoked();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível revogar o acesso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revogar acesso deste usuário?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação impedirá que {pessoa?.nome} acesse o portal em nome da sua empresa. O histórico
            de solicitações criadas por ele será mantido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void revogarAcesso();
            }}
            disabled={saving}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {saving ? "Revogando…" : "Sim, revogar acesso"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
