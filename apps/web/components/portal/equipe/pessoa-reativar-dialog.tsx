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
import { ApiError, portalReativarPessoaAutorizada, type PessoaAutorizadaRow } from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";

type PessoaReativarDialogProps = {
  pessoa: PessoaAutorizadaRow | null;
  open: boolean;
  onClose: () => void;
  onReativado: () => void;
};

export function PessoaReativarDialog({
  pessoa,
  open,
  onClose,
  onReativado,
}: PessoaReativarDialogProps) {
  const [saving, setSaving] = useState(false);

  async function reativarPerfil() {
    if (!pessoa) return;
    setSaving(true);
    try {
      await portalReativarPessoaAutorizada(pessoa.id);
      toast.success("Perfil reativado.");
      onReativado();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível reativar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reativar o perfil deste usuário?</AlertDialogTitle>
          <AlertDialogDescription>
            {pessoa?.nome} voltará a acessar o portal em nome da empresa, com as permissões que já
            tinha.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void reativarPerfil();
            }}
            disabled={saving}
          >
            {saving ? "Reativando…" : "Sim, reativar perfil"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
