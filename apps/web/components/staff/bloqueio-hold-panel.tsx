"use client";

import { useState } from "react";
import { AlertOctagon, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  staffAplicarBloqueioSolicitacao,
  staffLiberarBloqueioSolicitacao,
  type BloqueioContainerRow,
} from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/portal-tracking";

const TIPOS: BloqueioContainerRow["tipo"][] = [
  "FINANCEIRO",
  "FISCAL",
  "AVARIA",
  "JUDICIAL",
  "OPERACIONAL",
];

type BloqueioHoldPanelProps = {
  solicitacaoId: string;
  bloqueios: BloqueioContainerRow[];
  onChanged: () => void;
};

export function BloqueioHoldPanel({ solicitacaoId, bloqueios, onChanged }: BloqueioHoldPanelProps) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<BloqueioContainerRow["tipo"]>("OPERACIONAL");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const ativos = bloqueios.filter((b) => b.status === "ATIVO");

  async function onAplicar() {
    if (!motivo.trim()) {
      toast.error("Informe o motivo do bloqueio");
      return;
    }
    setBusy(true);
    try {
      await staffAplicarBloqueioSolicitacao(solicitacaoId, { tipo, motivo: motivo.trim() });
      toast.success("Bloqueio aplicado");
      setOpen(false);
      setMotivo("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao aplicar bloqueio");
    } finally {
      setBusy(false);
    }
  }

  async function onLiberar(bloqueioId: string) {
    setBusy(true);
    try {
      await staffLiberarBloqueioSolicitacao(solicitacaoId, bloqueioId);
      toast.success("Bloqueio liberado");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao liberar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {ativos.length ? (
        <div className="sticky top-0 z-20 rounded-xl border-2 border-rose-500 bg-rose-950/90 p-4 shadow-lg shadow-rose-950/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <AlertOctagon className="mt-0.5 h-8 w-8 shrink-0 text-rose-400" />
              <div>
                <p className="text-lg font-bold uppercase tracking-wide text-rose-50">
                  Unidade bloqueada — Hold ativo
                </p>
                {ativos.map((b) => (
                  <p key={b.id} className="mt-1 text-sm text-rose-100/95">
                    <span className="font-semibold">{b.tipo}</span>: {b.motivo}
                    <span className="ml-2 text-xs text-rose-200/70">{formatDateTime(b.dataBloqueio)}</span>
                  </p>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-rose-400/50 text-rose-100 hover:bg-rose-900"
              disabled={busy}
              onClick={() => void onLiberar(ativos[0]!.id)}
            >
              <Unlock className="mr-2 h-4 w-4" /> Liberar
            </Button>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        className="bg-rose-700 text-white hover:bg-rose-600"
        onClick={() => setOpen(true)}
      >
        <Lock className="mr-2 h-4 w-4" /> Aplicar bloqueio
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-rose-500/30 bg-[#0b101c]">
          <DialogHeader>
            <DialogTitle className="text-white">Aplicar bloqueio (Hold)</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Impede gate-out e leitura de QR até liberação explícita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-zinc-400">Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as BloqueioContainerRow["tipo"])}
                className="mt-1 w-full rounded-md border border-zinc-600 bg-black/40 px-3 py-2 text-white"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-zinc-400">Motivo (obrigatório)</Label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={500}
                className="mt-1 w-full rounded-md border border-zinc-600 bg-black/40 px-3 py-2 text-sm text-white"
                placeholder="Descreva a pendência…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-zinc-600" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="bg-rose-700 hover:bg-rose-600" disabled={busy} onClick={() => void onAplicar()}>
              {busy ? "…" : "Confirmar bloqueio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
