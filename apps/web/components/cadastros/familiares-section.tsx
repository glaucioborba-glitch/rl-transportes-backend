"use client";

import { Users } from "lucide-react";
import { FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import type { ColaboradorFamiliarForm } from "@/lib/api/cadastros-colaboradores-client";
import { FamiliarRow } from "./familiar-row";

type FamiliaresSectionProps = {
  familiares: ColaboradorFamiliarForm[];
  onAdd: () => void;
  onChange: (index: number, field: keyof ColaboradorFamiliarForm, value: string) => void;
  onRemove: (index: number) => void;
  maxFamiliares?: number;
};

export function FamiliaresSection({
  familiares,
  onAdd,
  onChange,
  onRemove,
  maxFamiliares = 10,
}: FamiliaresSectionProps) {
  return (
    <FormSection title="Familiares" icon={Users}>
      <p className="mb-4 text-xs text-muted-foreground">
        Cadastre familiares para futura agenda de eventos (aniversários, congratulações).
      </p>

      {familiares.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 py-6 text-center text-sm text-zinc-500">
          Nenhum familiar cadastrado.
        </div>
      ) : (
        <div className="space-y-3">
          {familiares.map((familiar, index) => (
            <FamiliarRow
              key={familiar.id ?? `familiar-${index}`}
              familiar={familiar}
              index={index}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      {familiares.length < maxFamiliares ? (
        <Button type="button" variant="outline" onClick={onAdd} className="mt-3 w-full border-dashed">
          + Adicionar familiar
        </Button>
      ) : null}
    </FormSection>
  );
}
