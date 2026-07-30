"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCPF } from "@/lib/cadastros/formatters";
import type { ColaboradorFamiliarForm } from "@/lib/api/cadastros-colaboradores-client";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const PARENTESCO_OPTIONS = [
  "Cônjuge",
  "Filho(a)",
  "Filha",
  "Pai",
  "Mãe",
  "Irmão(ã)",
  "Outro",
] as const;

type FamiliarRowProps = {
  familiar: ColaboradorFamiliarForm;
  index: number;
  onChange: (index: number, field: keyof ColaboradorFamiliarForm, value: string) => void;
  onRemove: (index: number) => void;
};

export function FamiliarRow({ familiar, index, onChange, onRemove }: FamiliarRowProps) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-3 md:grid-cols-12 md:items-end">
      <div className="md:col-span-4">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Nome *
        </label>
        <Input
          value={familiar.nome}
          onChange={(e) => onChange(index, "nome", e.target.value)}
          placeholder="Nome completo"
          className="bg-black/40"
        />
      </div>
      <div className="md:col-span-3">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          CPF
        </label>
        <Input
          value={familiar.cpf ? formatCPF(familiar.cpf) : ""}
          onChange={(e) => onChange(index, "cpf", e.target.value.replace(/\D/g, ""))}
          placeholder="000.000.000-00"
          maxLength={14}
          inputMode="numeric"
          className="bg-black/40 tabular-nums"
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Aniversário
        </label>
        <Input
          type="date"
          value={familiar.dataAniversario ?? ""}
          onChange={(e) => onChange(index, "dataAniversario", e.target.value)}
          className="bg-black/40"
        />
      </div>
      <div className="flex gap-2 md:col-span-3">
        <div className="flex-1">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Parentesco
          </label>
          <select
            value={familiar.parentesco ?? ""}
            onChange={(e) => onChange(index, "parentesco", e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Selecione...</option>
            {PARENTESCO_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="mt-6 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          aria-label="Remover familiar"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
