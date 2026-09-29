"use client";

import { GraduationCap } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ColaboradorNrValidade } from "@/lib/api/cadastros-colaboradores-client";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const RH_NR_OPTIONS = [
  { codigo: "NR-05", label: "NR-05 — CIPA" },
  { codigo: "NR-06", label: "NR-06 — EPI" },
  { codigo: "NR-11", label: "NR-11 — Movimentação / empilhadeiras" },
  { codigo: "NR-12", label: "NR-12 — Segurança em máquinas" },
  { codigo: "NR-17", label: "NR-17 — Ergonomia" },
  { codigo: "NR-20", label: "NR-20 — Inflamáveis" },
  { codigo: "NR-23", label: "NR-23 — Brigada / incêndio" },
  { codigo: "NR-33", label: "NR-33 — Espaços confinados" },
  { codigo: "NR-35", label: "NR-35 — Trabalho em altura" },
] as const;

type Props = {
  nrs: ColaboradorNrValidade[];
  cursoReachStackerValidade: string;
  onCursoChange: (value: string) => void;
  onNrsChange: (nrs: ColaboradorNrValidade[]) => void;
};

export function TreinamentosAgendaSection({
  nrs,
  cursoReachStackerValidade,
  onCursoChange,
  onNrsChange,
}: Props) {
  const addNr = () => {
    const used = new Set(nrs.map((n) => n.codigo));
    const next = RH_NR_OPTIONS.find((o) => !used.has(o.codigo));
    onNrsChange([...nrs, { codigo: next?.codigo ?? "NR-11", validade: "" }]);
  };

  const updateNr = (index: number, field: keyof ColaboradorNrValidade, value: string) => {
    onNrsChange(nrs.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const removeNr = (index: number) => {
    onNrsChange(nrs.filter((_, i) => i !== index));
  };

  return (
    <FormSection title="Treinamentos e NRs (agenda)" icon={GraduationCap}>
      <p className="mb-4 text-xs text-muted-foreground">
        Datas entram na Agenda do RH: vencimento de NR, curso de reach stacker e demais validades.
      </p>
      <div className="mb-4 flex flex-wrap gap-4">
        <FormField label="Curso operador de reach stacker (validade)" className="min-w-[16rem] flex-1">
          <Input
            type="date"
            value={cursoReachStackerValidade}
            onChange={(e) => onCursoChange(e.target.value)}
          />
        </FormField>
      </div>
      {nrs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 py-4 text-center text-sm text-zinc-500">
          Nenhuma NR com validade cadastrada.
        </div>
      ) : (
        <div className="space-y-3">
          {nrs.map((nr, index) => (
            <div key={`${nr.codigo}-${index}`} className="flex flex-wrap items-end gap-3">
              <FormField label="NR" className="min-w-[16rem] flex-1">
                <select
                  value={nr.codigo}
                  onChange={(e) => updateNr(index, "codigo", e.target.value)}
                  className={SELECT_CLASS}
                >
                  {RH_NR_OPTIONS.map((o) => (
                    <option key={o.codigo} value={o.codigo}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Validade" size="md">
                <Input
                  type="date"
                  value={nr.validade}
                  onChange={(e) => updateNr(index, "validade", e.target.value)}
                />
              </FormField>
              <Button type="button" variant="outline" size="sm" onClick={() => removeNr(index)}>
                Remover
              </Button>
            </div>
          ))}
        </div>
      )}
      {nrs.length < RH_NR_OPTIONS.length ? (
        <Button type="button" variant="outline" onClick={addNr} className="mt-3 w-full border-dashed">
          + Adicionar NR
        </Button>
      ) : null}
    </FormSection>
  );
}
