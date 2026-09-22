"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NavioAutocompleteInput } from "@/components/catalogo/navio-autocomplete-input";
import {
  ApiError,
  atualizarPatioEmbarque,
  type AlcanceEmbarquePatio,
  type CampoEmbarquePatio,
  type PortalPatioSaldoItem,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const COPY: Record<CampoEmbarquePatio, { titulo: string; label: string }> = {
  booking: { titulo: "Editar booking", label: "Booking" },
  processo: { titulo: "Editar processo", label: "Processo" },
  navio: { titulo: "Editar navio", label: "Navio" },
};

const ALCANCES: { value: AlcanceEmbarquePatio; label: string }[] = [
  { value: "unidade", label: "Alterar somente esta unidade" },
  { value: "processo", label: "Alterar todos desse processo" },
  { value: "booking", label: "Alterar todos deste booking" },
  { value: "navio", label: "Alterar todos desse navio" },
];

function valorAtual(item: PortalPatioSaldoItem, campo: CampoEmbarquePatio): string {
  if (campo === "booking") return item.booking?.trim() || "";
  if (campo === "processo") return item.processo?.trim() || "";
  return item.navio?.trim() || "";
}

function agrupamentoDisponivel(item: PortalPatioSaldoItem, alcance: AlcanceEmbarquePatio): boolean {
  if (alcance === "unidade") return true;
  if (alcance === "processo") return Boolean(item.processo?.trim());
  if (alcance === "booking") return Boolean(item.booking?.trim());
  return Boolean(item.navio?.trim());
}

export function EditarEmbarqueDialog({
  open,
  item,
  campo,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: PortalPatioSaldoItem | null;
  campo: CampoEmbarquePatio | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [novo, setNovo] = useState("");
  const [alcance, setAlcance] = useState<AlcanceEmbarquePatio>("unidade");
  const [saving, setSaving] = useState(false);

  const atual = item && campo ? valorAtual(item, campo) : "";
  const meta = campo ? COPY[campo] : null;

  useEffect(() => {
    if (open) {
      setNovo(atual);
      setAlcance("unidade");
    }
  }, [open, atual]);

  async function confirmar() {
    if (!item || !campo || !meta) return;
    if (!item.solicitacaoId) {
      toast.error("Esta unidade não tem solicitação vinculada para editar.");
      return;
    }
    if (!agrupamentoDisponivel(item, alcance)) {
      toast.error("Não há valor neste agrupamento para aplicar em lote.");
      return;
    }
    const valor = novo.trim();
    if (alcance === "unidade" && valor === atual) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await atualizarPatioEmbarque({
        solicitacaoId: item.solicitacaoId,
        unidadeIso: item.unidadeIso,
        campo,
        valor,
        alcance,
      });
      const n = res.atualizadas ?? 0;
      if (n <= 1) toast.success(`${meta.label} atualizado.`);
      else toast.success(`${meta.label} atualizado em ${n} unidades.`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar a alteração.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta?.titulo ?? "Editar"}</DialogTitle>
          <DialogDescription>
            Altere o {meta?.label.toLowerCase() ?? "dado"} desta unidade. A informação atual permanece
            visível ao lado da nova.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-white/10 bg-black/20">
            <CardContent className="space-y-2 py-4">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Informação atual
              </p>
              <p className="min-h-[2.5rem] break-all rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200">
                {atual || "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-black/20">
            <CardContent className="space-y-2 py-4">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Nova informação
              </p>
              {campo === "navio" ? (
                <NavioAutocompleteInput
                  source="portal"
                  value={novo}
                  onChange={setNovo}
                  disabled={saving}
                  placeholder="Nome do navio"
                />
              ) : (
                <Input
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  disabled={saving}
                  maxLength={120}
                  placeholder={`Novo ${meta?.label.toLowerCase() ?? "valor"}`}
                  className="bg-black/40"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <fieldset className="space-y-1 rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-xs font-medium text-slate-400">Alcance da alteração</legend>
          {ALCANCES.map((opt) => {
            const disponivel = item ? agrupamentoDisponivel(item, opt.value) : opt.value === "unidade";
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1.5 py-1.5 text-sm text-slate-200 hover:bg-white/5",
                  !disponivel && "cursor-not-allowed opacity-40 hover:bg-transparent",
                )}
              >
                <input
                  type="radio"
                  name="alcance-embarque"
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  checked={alcance === opt.value}
                  disabled={saving || !disponivel}
                  onChange={() => setAlcance(opt.value)}
                />
                {opt.label}
              </label>
            );
          })}
        </fieldset>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void confirmar()} disabled={saving}>
            {saving ? "Salvando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmbarqueEditButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 shrink-0 px-2 text-xs"
      onClick={onClick}
    >
      Editar
    </Button>
  );
}
