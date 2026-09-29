"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/cadastros/formatters";
import type { RhTurnoJornada, RegimeSabadoJornada } from "@/lib/api/rh-turnos-jornada-client";

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-black/40 px-3 py-2 text-sm";

function toPayload(t: RhTurnoJornada) {
  return {
    codigo: t.codigo,
    nome: t.nome,
    horaInicio: t.horaInicio,
    horaFim: t.horaFim,
    diasSemana: t.diasSemana,
    jornadaSemanalHoras: t.jornadaSemanalHoras ?? undefined,
    regimeSabado: (t.regimeSabado as RegimeSabadoJornada) || "SEM_SABADO",
    sabadoHoraInicio: t.sabadoHoraInicio ?? undefined,
    sabadoHoraFim: t.sabadoHoraFim ?? undefined,
    sabadoReferencia: t.sabadoReferencia || undefined,
    observacoes: t.observacoes ?? undefined,
    ativo: t.ativo,
  };
}

type Props = {
  turno: RhTurnoJornada;
  onChange: (next: RhTurnoJornada) => void;
  onSave: (payload: ReturnType<typeof toPayload>) => Promise<void>;
  onRemove?: () => Promise<void>;
  saving?: boolean;
};

export function RhTurnoJornadaCard({ turno, onChange, onSave, onRemove, saving }: Props) {
  const [localSaving, setLocalSaving] = useState(false);
  const busy = saving || localSaving;
  const espanhol = turno.regimeSabado === "ESPANHOL";
  const temSabado = turno.regimeSabado !== "SEM_SABADO";

  const patch = (partial: Partial<RhTurnoJornada>) => onChange({ ...turno, ...partial });

  const toggleDia = (dia: string) => {
    const active = turno.diasSemana.includes(dia);
    patch({
      diasSemana: active
        ? turno.diasSemana.filter((d) => d !== dia)
        : [...turno.diasSemana, dia],
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/60 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Código</label>
          <Input value={turno.codigo} onChange={(e) => patch({ codigo: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Nome</label>
          <Input value={turno.nome} onChange={(e) => patch({ nome: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Início</label>
          <Input
            type="time"
            value={turno.horaInicio}
            onChange={(e) => patch({ horaInicio: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Fim</label>
          <Input
            type="time"
            value={turno.horaFim}
            onChange={(e) => patch({ horaFim: e.target.value })}
          />
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Ativo</label>
            <Switch checked={turno.ativo} onCheckedChange={(v) => patch({ ativo: v })} />
          </div>
          {turno.id ? (
            <p className="text-xs text-zinc-500">{turno.colaboradores} colaborador(es)</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {DIAS.map((dia) => {
          const active = turno.diasSemana.includes(dia);
          return (
            <button
              key={dia}
              type="button"
              onClick={() => toggleDia(dia)}
              className={`rounded px-2 py-1 text-[10px] ${
                active ? "bg-cyan-500 text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}
            >
              {dia}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">
            Sábado
          </label>
          <select
            value={turno.regimeSabado}
            onChange={(e) => patch({ regimeSabado: e.target.value as RegimeSabadoJornada })}
            className={SELECT_CLASS}
          >
            <option value="SEM_SABADO">Folga todo sábado</option>
            <option value="TODOS_SABADOS">Trabalha todo sábado</option>
            <option value="ESPANHOL">Sistema espanhol (um sim, um não)</option>
          </select>
        </div>
        {temSabado ? (
          <>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">
                Sábado início
              </label>
              <Input
                type="time"
                value={turno.sabadoHoraInicio ?? "07:00"}
                onChange={(e) => patch({ sabadoHoraInicio: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">
                Sábado fim (dia todo)
              </label>
              <Input
                type="time"
                value={turno.sabadoHoraFim ?? "17:00"}
                onChange={(e) => patch({ sabadoHoraFim: e.target.value })}
              />
            </div>
          </>
        ) : null}
      </div>

      {espanhol ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">
              Sábado de referência (trabalha)
            </label>
            <Input
              type="date"
              value={turno.sabadoReferencia ?? ""}
              onChange={(e) => patch({ sabadoReferencia: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Ancora o ciclo: este sábado a turma trabalha o dia todo; o seguinte folga.
            </p>
          </div>
          {turno.espanhol ? (
            <p className="self-end text-sm text-cyan-200">
              Próximo trabalho {formatDate(turno.espanhol.trabalha)} · folga{" "}
              {formatDate(turno.espanhol.folga)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">
          Observações
        </label>
        <Input
          value={turno.observacoes ?? ""}
          onChange={(e) => patch({ observacoes: e.target.value })}
          placeholder="Quem usa este turno, exceções…"
        />
      </div>

      <div className="flex justify-end gap-2">
        {turno.id && onRemove ? (
          <Button
            type="button"
            variant="ghost"
            className="text-red-400"
            disabled={busy}
            onClick={() => void onRemove()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Inativar
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={busy || !turno.codigo.trim() || !turno.nome.trim()}
          onClick={() => {
            setLocalSaving(true);
            void onSave(toPayload(turno)).finally(() => setLocalSaving(false));
          }}
        >
          {busy ? "Salvando…" : "Salvar turno"}
        </Button>
      </div>
    </div>
  );
}
