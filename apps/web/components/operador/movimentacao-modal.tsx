"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MovimentacaoModal({
  open,
  onOpenChange,
  quadrasDestino,
  defaultQuadra,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quadrasDestino: string[];
  defaultQuadra: string;
  onSubmit: (destQuadra: string, fileira: string, posicao: string, obs: string) => void;
}) {
  const [dest, setDest] = useState(defaultQuadra);
  const [fileira, setFileira] = useState("F1");
  const [posicao, setPosicao] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (open) {
      setDest(defaultQuadra || quadrasDestino[0] || "A1");
      setFileira("F1");
      setPosicao(`P-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
      setObs("");
    }
  }, [open, defaultQuadra, quadrasDestino]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0c0f14] text-white">
        <DialogHeader>
          <DialogTitle>Movimentar unidade</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <label className="text-xs text-slate-500">Quadra destino</label>
            <select
              className="mt-1 flex min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-white"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
            >
              {quadrasDestino.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Fileira</label>
            <Input
              className="border-white/15 bg-black/40 text-white"
              value={fileira}
              onChange={(e) => setFileira(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Posição (única)</label>
            <Input
              className="border-white/15 bg-black/40 font-mono text-white"
              value={posicao}
              onChange={(e) => setPosicao(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Observação</label>
            <Input
              className="border-white/15 bg-black/40 text-white"
              placeholder="Opcional"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSubmit(dest, fileira, posicao, obs);
              onOpenChange(false);
            }}
          >
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SaidaActionButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" className="min-h-14 w-full text-lg" disabled={disabled} onClick={onClick}>
      Registrar saída (POST /solicitacoes/saida)
    </Button>
  );
}
