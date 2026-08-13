"use client";

import { useRouter } from "next/navigation";
import { Clock, Edit2, Plus, Users } from "lucide-react";
import { OperacionalBreadcrumb, OperacionalTabs } from "../components/operacional-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosTurnos, type CadastroTurno } from "@/lib/api/cadastros-turnos-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

const DIAS_LABEL: Record<string, string> = {
  SEG: "Seg",
  TER: "Ter",
  QUA: "Qua",
  QUI: "Qui",
  SEX: "Sex",
  SAB: "Sáb",
  DOM: "Dom",
};

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  );
}

function TurnoCard({
  turno,
  canEdit,
  onEdit,
}: {
  turno: CadastroTurno;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-[var(--accent)]/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)]/10">
            <Clock className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="font-mono text-base font-bold">{turno.codigo}</p>
            <p className="text-sm text-muted-foreground">{turno.nome}</p>
          </div>
        </div>
        <Badge
          variant="neutral"
          className={
            turno.ativo
              ? "border-green-500/30 bg-green-500/15 text-green-400"
              : "border-red-500/30 bg-red-500/15 text-red-400"
          }
        >
          {turno.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">
          {turno.horaInicio} — {turno.horaFim}
        </span>
      </div>

      {turno.capacidadeMaxima != null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          Capacidade: {turno.capacidadeMaxima} operação(ões)
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {turno.diasSemana.map((dia) => (
          <Badge key={dia} variant="neutral" className="text-xs">
            {DIAS_LABEL[dia] ?? dia}
          </Badge>
        ))}
      </div>

      {canEdit ? (
        <div className="mt-auto pt-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="w-full">
            <Edit2 className="mr-2 h-3.5 w-3.5" /> Editar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function TurnosListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const { data, loading, error, refetch } = useWidgetData(() => listCadastrosTurnos(), []);
  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");
  const turnos = data?.items ?? [];

  return (
    <div className="space-y-6">
      <OperacionalBreadcrumb current="Turnos" />
      <OperacionalTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Turnos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Janelas de operação do terminal · Capacidade e dias da semana
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/operacional/turnos/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Turno
          </Button>
        ) : null}
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar turnos" onRetry={refetch} />
      ) : null}

      {!loading && !error && turnos.length === 0 ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
          <Clock className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg text-muted-foreground">Nenhum turno cadastrado.</p>
        </div>
      ) : null}

      {!loading && !error && turnos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {turnos.map((turno) => (
            <TurnoCard
              key={turno.id}
              turno={turno}
              canEdit={canEdit}
              onEdit={() => router.push(`/cadastros/operacional/turnos/${turno.id}`)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
