"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import type { TenantTurnoOperacionalConfig } from "@/lib/api/tenant-config-client";

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;

interface TurnoRowProps {
  turno: TenantTurnoOperacionalConfig;
  index: number;
  disabled?: boolean;
  onChange: (index: number, field: keyof TenantTurnoOperacionalConfig, value: unknown) => void;
  onRemove: (index: number) => void;
}

export function TurnoRow({ turno, index, disabled, onChange, onRemove }: TurnoRowProps) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-3 md:grid-cols-8">
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Código</label>
        <Input
          value={turno.codigo}
          disabled={disabled}
          onChange={(e) => onChange(index, "codigo", e.target.value)}
          placeholder="MANHA"
          className="bg-black/40"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Slot</label>
        <select
          value={turno.slot ?? "MANHA"}
          disabled={disabled}
          onChange={(e) => onChange(index, "slot", e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-black/40 px-3 py-2 text-sm"
        >
          <option value="MANHA">Manhã</option>
          <option value="TARDE">Tarde</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Nome</label>
        <Input
          value={turno.nome}
          disabled={disabled}
          onChange={(e) => onChange(index, "nome", e.target.value)}
          placeholder="Manhã"
          className="bg-black/40"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Início</label>
        <Input
          type="time"
          value={turno.horaInicio}
          disabled={disabled}
          onChange={(e) => onChange(index, "horaInicio", e.target.value)}
          className="bg-black/40"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Fim</label>
        <Input
          type="time"
          value={turno.horaFim}
          disabled={disabled}
          onChange={(e) => onChange(index, "horaFim", e.target.value)}
          className="bg-black/40"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Capacidade</label>
        <Input
          type="number"
          min={1}
          max={500}
          value={turno.capacidadeMaxima}
          disabled={disabled}
          onChange={(e) => onChange(index, "capacidadeMaxima", Number(e.target.value) || 1)}
          className="bg-black/40"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Ativo</label>
        <Switch
          checked={turno.ativo}
          disabled={disabled}
          onCheckedChange={(v) => onChange(index, "ativo", v)}
        />
      </div>
      <div className="flex items-end justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={() => onRemove(index)}
          className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1 md:col-span-8">
        {DIAS.map((dia) => {
          const active = turno.diasSemana?.includes(dia);
          return (
            <button
              key={dia}
              type="button"
              disabled={disabled}
              onClick={() => {
                const dias = active
                  ? turno.diasSemana.filter((d) => d !== dia)
                  : [...(turno.diasSemana ?? []), dia];
                onChange(index, "diasSemana", dias);
              }}
              className={`rounded px-2 py-1 text-[10px] ${
                active
                  ? "bg-cyan-500 text-black"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}
            >
              {dia}
            </button>
          );
        })}
      </div>
    </div>
  );
}
