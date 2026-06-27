"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RhCard } from "@/components/rh/rh-card";
import { ApiError } from "@/lib/api/staff-client";
import {
  fetchEscalas,
  fetchFuncionarios,
  TURNO_LABELS,
  upsertEscalas,
  type FuncionarioRow,
  type TurnoEscala,
} from "@/lib/api/workforce-rh-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { cn } from "@/lib/utils";

const TURNOS: TurnoEscala[] = ["MANHA", "TARDE", "NOITE"];

function startOfWeekMonday(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

function addDaysUtc(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function RhEquipeEscalasPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [funcionarios, setFuncionarios] = useState<FuncionarioRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, TurnoEscala | "">>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysUtc(weekStart, i)),
    [weekStart],
  );

  const dataInicio = isoDate(days[0]!);
  const dataFim = isoDate(days[6]!);

  const operacionais = useMemo(
    () => funcionarios.filter((f) => f.status === "ATIVO" && f.cargo !== "ADMINISTRATIVO"),
    [funcionarios],
  );

  const cellKey = (funcionarioId: string, data: string) => `${funcionarioId}|${data}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [funcs, escalas] = await Promise.all([
        fetchFuncionarios({ status: "ATIVO" }),
        fetchEscalas(dataInicio, dataFim),
      ]);
      setFuncionarios(funcs);
      const map: Record<string, TurnoEscala | ""> = {};
      for (const e of escalas) {
        const d = e.data.slice(0, 10);
        map[cellKey(e.funcionarioId, d)] = e.turno;
      }
      setAssignments(map);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar escalas");
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    void load();
  }, [load]);

  function setCell(funcionarioId: string, data: string, turno: TurnoEscala | "") {
    setAssignments((prev) => ({ ...prev, [cellKey(funcionarioId, data)]: turno }));
  }

  async function onSave() {
    setSaving(true);
    try {
      const payload: Array<{ funcionarioId: string; data: string; turno: TurnoEscala | null }> = [];
      for (const f of operacionais) {
        for (const d of days) {
          const data = isoDate(d);
          const turno = assignments[cellKey(f.id, data)] ?? "";
          payload.push({ funcionarioId: f.id, data, turno: turno || null });
        }
      }
      await upsertEscalas(payload);
      toast.success("Escalas salvas");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao salvar escalas");
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return <p className="text-center text-amber-400">Acesso restrito.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Matriz de escalas</h1>
          <p className="text-sm text-zinc-500">
            Alocação semanal · cruzada com agendamentos no motor de capacity planning.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="border-zinc-600">
          <Link href="/rh/equipe">Gerenciar equipe</Link>
        </Button>
      </div>

      <RhCard title="Semana de referência">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWeekStart((w) => addDaysUtc(w, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-sm text-cyan-200">
            {dataInicio} → {dataFim}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWeekStart((w) => addDaysUtc(w, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" className="ml-auto bg-cyan-700 hover:bg-cyan-600" disabled={saving} onClick={() => void onSave()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar semana
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Carregando matriz…</p>
        ) : operacionais.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Cadastre funcionários operacionais em{" "}
            <Link href="/rh/equipe" className="text-cyan-400 underline">
              RH / Equipe
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-[720px] w-full border-collapse text-center text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-zinc-900/90 text-zinc-400">
                  <th className="px-2 py-2 text-left">Colaborador</th>
                  {days.map((d, i) => (
                    <th key={isoDate(d)} className="px-1 py-2">
                      <div>{DOW[i]}</div>
                      <div className="font-mono text-[10px] text-zinc-500">{isoDate(d).slice(5)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operacionais.map((f) => (
                  <tr key={f.id} className="border-b border-white/5">
                    <td className="px-2 py-2 text-left text-sm text-white">{f.nome}</td>
                    {days.map((d) => {
                      const data = isoDate(d);
                      const val = assignments[cellKey(f.id, data)] ?? "";
                      return (
                        <td key={data} className="px-1 py-1">
                          <select
                            value={val}
                            onChange={(e) =>
                              setCell(f.id, data, (e.target.value || "") as TurnoEscala | "")
                            }
                            className={cn(
                              "w-full rounded-md border border-white/10 bg-zinc-900/80 px-1 py-1.5 text-[11px] text-white",
                              val === "NOITE" && "border-indigo-500/40",
                              val === "TARDE" && "border-amber-500/40",
                              val === "MANHA" && "border-cyan-500/40",
                            )}
                          >
                            <option value="">—</option>
                            {TURNOS.map((t) => (
                              <option key={t} value={t}>
                                {TURNO_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          Capacidade heurística: 15 movimentos/turno por empilhadeira · 20 check-ins/turno por gate checker.
        </p>
      </RhCard>
    </div>
  );
}
