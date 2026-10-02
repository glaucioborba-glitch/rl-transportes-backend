"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { RhTurnoJornadaCard } from "@/components/rh/rh-turno-jornada-card";
import { Button } from "@/components/ui/button";
import { WidgetError, useWidgetData } from "@/components/ui/widget-error";
import {
  createRhTurnoJornada,
  emptyRhTurnoJornada,
  listRhTurnosJornada,
  removeRhTurnoJornada,
  templateEspanhol,
  updateRhTurnoJornada,
  type RhTurnoJornada,
} from "@/lib/api/rh-turnos-jornada-client";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function RhTurnosPage() {
  const allowed = useStaffAuthStore((s) => isIntranetGestorRole(s.user?.role));
  const { data, loading, error, refetch } = useWidgetData(() => listRhTurnosJornada(), []);
  const [draft, setDraft] = useState<RhTurnoJornada | null>(null);
  const [edits, setEdits] = useState<Record<string, RhTurnoJornada>>({});

  if (!allowed) return <p className="text-center text-amber-400">Acesso restrito.</p>;

  const items = (data?.items ?? []).map((t) => edits[t.id] ?? t);

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
        <h1 className="text-2xl font-bold">Turnos da equipe</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Jornada dos colaboradores — não confundir com os turnos operacionais do Gate (Parâmetros).
          Dias úteis usam quatro batidas (início, intervalo, retorno e saída). Quem trabalha todo
          sábado faz só 4 horas contínuas (entrada e saída). No sistema espanhol o sábado trabalhado
          é o dia todo, com intervalo.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando turnos…</p> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar os turnos" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="space-y-4">
          {items.map((turno) => (
            <RhTurnoJornadaCard
              key={turno.id}
              turno={turno}
              onChange={(next) => setEdits((prev) => ({ ...prev, [turno.id]: next }))}
              onSave={async (payload) => {
                await updateRhTurnoJornada(turno.id, payload);
                toast.success("Turno atualizado.");
                setEdits((prev) => {
                  const copy = { ...prev };
                  delete copy[turno.id];
                  return copy;
                });
                refetch();
              }}
              onRemove={async () => {
                await removeRhTurnoJornada(turno.id);
                toast.success("Turno inativado.");
                refetch();
              }}
            />
          ))}

          {draft ? (
            <RhTurnoJornadaCard
              turno={draft}
              onChange={setDraft}
              onSave={async (payload) => {
                await createRhTurnoJornada(payload);
                toast.success("Turno criado. Anexe-o na ficha do colaborador.");
                setDraft(null);
                refetch();
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-dashed" onClick={() => setDraft(emptyRhTurnoJornada())}>
                <Plus className="mr-2 h-4 w-4" />
                Novo turno
              </Button>
              <Button type="button" variant="outline" onClick={() => setDraft(templateEspanhol())}>
                Modelo sistema espanhol
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
