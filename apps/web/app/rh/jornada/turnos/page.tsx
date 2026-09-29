"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Save } from "lucide-react";
import { TurnoRow } from "@/app/cadastros/parametros/operacional/turno-row";
import { Button } from "@/components/ui/button";
import { useParametrosGerais } from "@/hooks/use-parametros-gerais";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import type { TenantTurnoOperacionalConfig } from "@/lib/api/tenant-config-client";

function newTurno(): TenantTurnoOperacionalConfig {
  return {
    id: `t-${Date.now()}`,
    codigo: "T5",
    slot: "MANHA",
    nome: "Novo turno",
    horaInicio: "07:00",
    horaFim: "14:00",
    capacidadeMaxima: 10,
    diasSemana: ["SEG", "TER", "QUA", "QUI", "SEX"],
    ativo: true,
  };
}

export default function RhJornadaTurnosPage() {
  const allowed = useStaffAuthStore((s) => isIntranetGestorRole(s.user?.role));
  const { data, loading, error, update } = useParametrosGerais();
  const [turnos, setTurnos] = useState<TenantTurnoOperacionalConfig[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.operacional?.turnos) setTurnos(data.operacional.turnos);
  }, [data]);

  if (!allowed) return <p className="text-amber-400">Acesso restrito.</p>;

  const updateTurno = (index: number, field: keyof TenantTurnoOperacionalConfig, value: unknown) => {
    const next = [...turnos];
    next[index] = { ...next[index], [field]: value };
    setTurnos(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({
        operacional: {
          turnos: turnos.map((t) => ({
            id: t.id,
            slot: t.slot ?? "MANHA",
            codigo: t.codigo.trim().slice(0, 32),
            nome: t.nome.trim(),
            horaInicio: t.horaInicio.slice(0, 5),
            horaFim: t.horaFim.slice(0, 5),
            capacidadeMaxima: Math.max(1, Number(t.capacidadeMaxima) || 1),
            diasSemana: t.diasSemana?.length ? t.diasSemana : ["SEG", "TER", "QUA", "QUI", "SEX"],
            ativo: t.ativo !== false,
          })),
        },
      });
      toast.success("Turnos salvos. O cadastro de colaboradores e o Gate usam esta lista.");
    } catch {
      toast.error("Não foi possível salvar os turnos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/rh" className="hover:text-white">
            RH
          </Link>
          <span>/</span>
          <span>Turnos</span>
        </div>
        <h1 className="text-2xl font-bold">Turnos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cadastro da equipe. Os mesmos turnos alimentam o colaborador e o agendamento do Gate
          (fonte: parâmetros operacionais do terminal).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando turnos…
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {!loading && !error ? (
        <div className="space-y-3">
          {turnos.map((turno, index) => (
            <TurnoRow
              key={turno.id || index}
              turno={turno}
              index={index}
              onChange={updateTurno}
              onRemove={(i) => setTurnos(turnos.filter((_, idx) => idx !== i))}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setTurnos([...turnos, newTurno()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar turno
          </Button>
          <div className="flex justify-end">
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar turnos
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
