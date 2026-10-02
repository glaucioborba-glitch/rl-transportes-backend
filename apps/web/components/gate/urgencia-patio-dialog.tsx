"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/staff-client";
import { enfileirarPatio, type PatioFilaUrgencia } from "@/lib/api/patio-fila-client";
import { toast } from "@/lib/toast";

const OPCOES: Array<{
  urgencia: PatioFilaUrgencia;
  label: string;
  detalhe: string;
  className: string;
}> = [
  {
    urgencia: "PRIORITARIO",
    label: "Prioritário",
    detalhe: "Sobe na frente da fila do pátio",
    className: "border-orange-500 bg-orange-500 text-zinc-950 hover:bg-orange-400",
  },
  {
    urgencia: "PREFERENCIAL",
    label: "Preferencial",
    detalhe: "Depois dos prioritários",
    className: "border-amber-400 bg-amber-400 text-zinc-950 hover:bg-amber-300",
  },
  {
    urgencia: "NORMAL",
    label: "Normal",
    detalhe: "Entra por último no grupo verde",
    className: "border-emerald-500 bg-emerald-500 text-zinc-950 hover:bg-emerald-400",
  },
];

type Props = {
  open: boolean;
  protocolo: string;
  onOpenChange: (open: boolean) => void;
  onEnviado?: () => void;
};

export function UrgenciaPatioDialog({ open, protocolo, onOpenChange, onEnviado }: Props) {
  const [busy, setBusy] = useState<PatioFilaUrgencia | null>(null);

  async function enviar(urgencia: PatioFilaUrgencia) {
    setBusy(urgencia);
    try {
      await enfileirarPatio(protocolo, urgencia);
      toast.success("Enviado ao pátio.");
      onOpenChange(false);
      onEnviado?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar ao pátio.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar ao pátio</DialogTitle>
          <DialogDescription>
            Escolha a urgência. A unidade entra por último dentro do grupo selecionado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {OPCOES.map((op) => (
            <button
              key={op.urgencia}
              type="button"
              disabled={busy !== null}
              onClick={() => void enviar(op.urgencia)}
              className={`min-h-16 rounded-2xl border px-4 py-3 text-left font-bold disabled:opacity-60 ${op.className}`}
            >
              <span className="block text-lg">{op.label}</span>
              <span className="block text-sm font-medium opacity-80">
                {busy === op.urgencia ? "Enviando…" : op.detalhe}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
