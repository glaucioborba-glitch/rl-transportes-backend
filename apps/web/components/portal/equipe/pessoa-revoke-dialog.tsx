"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  async function handleRevoke() {
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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revogar acesso deste usuário?</DialogTitle>
          <DialogDescription>
            Esta ação impedirá que <span className="font-medium text-slate-200">{pessoa?.nome}</span>{" "}
            acesse o portal em nome da sua empresa. O histórico de solicitações criadas por ele será
            mantido.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => void handleRevoke()}
            disabled={saving}
          >
            {saving ? "Revogando…" : "Sim, revogar acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
