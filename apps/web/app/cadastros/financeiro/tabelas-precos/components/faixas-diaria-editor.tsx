"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FaixaDiariaForm = {
  diaInicio: string;
  diaFim: string;
  valorDiaria: string;
};

type Props = {
  faixas: FaixaDiariaForm[];
  onChange: (faixas: FaixaDiariaForm[]) => void;
  freeTimeDias?: string;
};

export function FaixasDiariaEditor({ faixas, onChange, freeTimeDias }: Props) {
  const add = () =>
    onChange([
      ...faixas,
      {
        diaInicio: String(Number(freeTimeDias || 7) + 1),
        diaFim: "",
        valorDiaria: "30",
      },
    ]);

  const update = (index: number, field: keyof FaixaDiariaForm, value: string) => {
    onChange(faixas.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  };

  const remove = (index: number) => onChange(faixas.filter((_, i) => i !== index));

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Faixas de diária (após free time)</p>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-3 w-3" /> Faixa
        </Button>
      </div>
      {faixas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma faixa — usa padrão 8–15 @ R$30, 16+ @ R$45.</p>
      ) : (
        faixas.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
            <Input
              type="number"
              min={1}
              placeholder="Dia início"
              value={f.diaInicio}
              onChange={(e) => update(i, "diaInicio", e.target.value)}
            />
            <Input
              type="number"
              min={1}
              placeholder="Dia fim (vazio = ∞)"
              value={f.diaFim}
              onChange={(e) => update(i, "diaFim", e.target.value)}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="R$/dia"
              value={f.valorDiaria}
              onChange={(e) => update(i, "valorDiaria", e.target.value)}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
