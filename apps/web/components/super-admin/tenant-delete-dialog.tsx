"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import type { SaasTenantRow } from "@/lib/api/super-admin-client";

type Props = {
  tenant: SaasTenantRow | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function TenantDeleteDialog({ tenant, open, saving, onClose, onConfirm }: Props) {
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (open) setSlug("");
  }, [open, tenant?.id]);

  if (!tenant) return null;

  const bloqueado = Boolean(tenant.bloqueioExclusao);
  const confere = slug.trim().toLowerCase() === tenant.id.toLowerCase();

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {tenant.nome}?</AlertDialogTitle>
          <AlertDialogDescription>
            {bloqueado
              ? tenant.bloqueioExclusao
              : "Apaga o terminal e a configuração inicial. Não dá para desfazer. Digite o slug para confirmar."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!bloqueado ? (
          <Input
            autoComplete="off"
            placeholder={tenant.id}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="bg-black/40 font-mono"
          />
        ) : (
          <p className="text-sm text-amber-200/90">Use Bloquear para impedir o acesso sem perder o histórico.</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            className="border-red-500/40 bg-red-950/30 text-red-200 hover:bg-red-950/50"
            disabled={saving || bloqueado || !confere}
            onClick={() => void onConfirm()}
          >
            {saving ? "Excluindo…" : "Excluir terminal"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
