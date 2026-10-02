"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ContainerPilha } from "@/lib/patiamento/types";

export function AgendarRetiradaModal({
  open,
  onOpenChange,
  container,
  pilhaCodigo,
  exigeRemocao,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: ContainerPilha | null;
  pilhaCodigo: string;
  exigeRemocao: boolean;
  onConfirm: () => void;
}) {
  if (!container) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar retirada</DialogTitle>
          <DialogDescription>
            Confirme o agendamento de retirada do contêiner na baia {pilhaCodigo}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Contêiner</span>
            <span className="font-mono font-semibold text-white">{container.numero}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Tipo</span>
            <span className="text-white">{container.tipo}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Cliente final</span>
            <span className="text-right text-white">{container.clienteFinal}</span>
          </div>
        </div>

        {exigeRemocao ? (
          <div
            role="alert"
            className="flex gap-3 rounded-lg border border-orange-500/40 bg-orange-500/10 p-4 text-sm text-orange-100"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" aria-hidden />
            <p>
              <strong className="font-semibold text-orange-50">Atenção:</strong> Este contêiner está
              sob outras unidades. O agendamento gerará uma{" "}
              <strong>Ordem de Serviço de preparação prévia no pátio</strong> (shifting).
            </p>
          </div>
        ) : (
          <p className="text-sm text-emerald-200/90">
            Este contêiner está no topo da pilha e pode ser retirado sem remoções adicionais.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            Confirmar agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
