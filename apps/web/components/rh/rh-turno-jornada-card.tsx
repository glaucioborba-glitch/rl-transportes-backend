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

function timeOr(value: string | null | undefined, fallback = "") {
  return value?.slice(0, 5) || fallback;
}

function toPayload(t: RhTurnoJornada) {
  const regime = (t.regimeSabado as RegimeSabadoJornada) || "SEM_SABADO";
  const sabadoCurto = regime === "TODOS_SABADOS";
  return {
    codigo: t.codigo,
    nome: t.nome,
    horaInicio: t.horaInicio,
    intervaloInicio: t.intervaloInicio || undefined,
    intervaloFim: t.intervaloFim || undefined,
    horaFim: t.horaFim,
    diasSemana: t.diasSemana,
    jornadaSemanalHoras: t.jornadaSemanalHoras ?? undefined,
    regimeSabado: regime,
    sabadoHoraInicio: t.sabadoHoraInicio ?? undefined,
    sabadoIntervaloInicio: sabadoCurto ? undefined : t.sabadoIntervaloInicio ?? undefined,
    sabadoIntervaloFim: sabadoCurto ? undefined : t.sabadoIntervaloFim ?? undefined,
    sabadoHoraFim: t.sabadoHoraFim ?? undefined,
    sabadoReferencia: t.sabadoReferencia || undefined,
    observacoes: t.observacoes ?? undefined,
    ativo: t.ativo,
  };
}

function BatidasRow({
  inicio,
  intervaloInicio,
  intervaloFim,
  saida,
  somenteEntradaSaida,
  onInicio,
  onIntervaloInicio,
  onIntervaloFim,
  onSaida,
}: {
  inicio: string;
  intervaloInicio: string;
  intervaloFim: string;
  saida: string;
  somenteEntradaSaida?: boolean;
  onInicio: (v: string) => void;
  onIntervaloInicio: (v: string) => void;
  onIntervaloFim: (v: string) => void;
  onSaida: (v: string) => void;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 ${somenteEntradaSaida ? "md:grid-cols-2" : "md:grid-cols-4"}`}
    >
      <TimeField label="Início" value={inicio} onChange={onInicio} />
      {somenteEntradaSaida ? null : (
        <>
          <TimeField label="Início intervalo" value={intervaloInicio} onChange={onIntervaloInicio} />
          <TimeField label="Retorno intervalo" value={intervaloFim} onChange={onIntervaloFim} />
        </>
      )}
      <TimeField label="Saída" value={saida} onChange={onSaida} />
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">{label}</label>
      <Input type="time" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
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
  const sabadoCurto = turno.regimeSabado === "TODOS_SABADOS";
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
        <div className="md:col-span-3">
          <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Nome</label>
          <Input value={turno.nome} onChange={(e) => patch({ nome: e.target.value })} />
        </div>
        <div className="flex items-end justify-between gap-2 md:col-span-2">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">Ativo</label>
            <Switch checked={turno.ativo} onCheckedChange={(v) => patch({ ativo: v })} />
          </div>
          {turno.id ? (
            <p className="text-xs text-zinc-500">{turno.colaboradores} colaborador(es)</p>
          ) : null}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
          Dias úteis — quatro batidas
        </p>
        <BatidasRow
          inicio={timeOr(turno.horaInicio, "07:00")}
          intervaloInicio={timeOr(turno.intervaloInicio)}
          intervaloFim={timeOr(turno.intervaloFim)}
          saida={timeOr(turno.horaFim, "16:00")}
          onInicio={(v) => patch({ horaInicio: v })}
          onIntervaloInicio={(v) => patch({ intervaloInicio: v || null })}
          onIntervaloFim={(v) => patch({ intervaloFim: v || null })}
          onSaida={(v) => patch({ horaFim: v })}
        />
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
            onChange={(e) => {
              const regime = e.target.value as RegimeSabadoJornada;
              if (regime === "TODOS_SABADOS") {
                patch({
                  regimeSabado: regime,
                  sabadoHoraInicio: "07:00",
                  sabadoIntervaloInicio: null,
                  sabadoIntervaloFim: null,
                  sabadoHoraFim: "11:00",
                });
                return;
              }
              if (regime === "ESPANHOL") {
                patch({
                  regimeSabado: regime,
                  sabadoHoraInicio: turno.sabadoHoraInicio || "07:00",
                  sabadoIntervaloInicio: turno.sabadoIntervaloInicio || "12:00",
                  sabadoIntervaloFim: turno.sabadoIntervaloFim || "13:00",
                  sabadoHoraFim: turno.sabadoHoraFim && turno.sabadoHoraFim !== "11:00"
                    ? turno.sabadoHoraFim
                    : "17:00",
                });
                return;
              }
              patch({ regimeSabado: regime });
            }}
            className={SELECT_CLASS}
          >
            <option value="SEM_SABADO">Folga todo sábado</option>
            <option value="TODOS_SABADOS">Trabalha todo sábado (4 horas)</option>
            <option value="ESPANHOL">Sistema espanhol (um sim, um não)</option>
          </select>
        </div>
      </div>

      {temSabado ? (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            {sabadoCurto
              ? "Sábado — 4 horas, só entrada e saída"
              : "Sábado (quando trabalha) — quatro batidas"}
          </p>
          <BatidasRow
            inicio={timeOr(turno.sabadoHoraInicio, "07:00")}
            intervaloInicio={timeOr(turno.sabadoIntervaloInicio, sabadoCurto ? "" : "12:00")}
            intervaloFim={timeOr(turno.sabadoIntervaloFim, sabadoCurto ? "" : "13:00")}
            saida={timeOr(turno.sabadoHoraFim, sabadoCurto ? "11:00" : "17:00")}
            somenteEntradaSaida={sabadoCurto}
            onInicio={(v) => patch({ sabadoHoraInicio: v })}
            onIntervaloInicio={(v) => patch({ sabadoIntervaloInicio: v || null })}
            onIntervaloFim={(v) => patch({ sabadoIntervaloFim: v || null })}
            onSaida={(v) => patch({ sabadoHoraFim: v })}
          />
        </div>
      ) : null}

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
