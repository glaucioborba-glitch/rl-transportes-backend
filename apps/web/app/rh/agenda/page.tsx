"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { RhCard } from "@/components/rh/rh-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WidgetError, useWidgetData } from "@/components/ui/widget-error";
import {
  fetchRhAgenda,
  type RhAgendaEvento,
  type RhAgendaTipo,
} from "@/lib/api/cadastros-colaboradores-client";
import { formatDate } from "@/lib/cadastros/formatters";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

const TIPO_LABEL: Record<RhAgendaTipo, string> = {
  ANIVERSARIO_COLABORADOR: "Aniversário",
  ANIVERSARIO_DEPENDENTE: "Aniversário (dependente)",
  CONTRATO_EXPERIENCIA: "Contrato de experiência",
  AVALIACAO_EXPERIENCIA: "Avaliação 45 dias",
  NR: "NR",
  CURSO_REACH_STACKER: "Reach stacker",
  CNH: "CNH",
};

type Filtro = "todos" | "aniversarios" | "contratos" | "vencimentos";

function matchFiltro(tipo: RhAgendaTipo, filtro: Filtro): boolean {
  if (filtro === "todos") return true;
  if (filtro === "aniversarios") {
    return tipo === "ANIVERSARIO_COLABORADOR" || tipo === "ANIVERSARIO_DEPENDENTE";
  }
  if (filtro === "contratos") {
    return tipo === "CONTRATO_EXPERIENCIA" || tipo === "AVALIACAO_EXPERIENCIA";
  }
  return tipo === "NR" || tipo === "CURSO_REACH_STACKER" || tipo === "CNH";
}

function urgenciaBadge(urgencia: RhAgendaEvento["urgencia"]): "rejeitado" | "pendente" | "aprovado" | "concluido" | "neutral" {
  if (urgencia === "vencido") return "rejeitado";
  if (urgencia === "hoje") return "pendente";
  if (urgencia === "proximo") return "pendente";
  if (urgencia === "atencao") return "concluido";
  return "neutral";
}

function diasLabel(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  if (dias < 0) return `há ${Math.abs(dias)} dias`;
  return `em ${dias} dias`;
}

export default function RhAgendaPage() {
  const allowed = useStaffAuthStore((s) => isIntranetGestorRole(s.user?.role));
  const [dias, setDias] = useState(90);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const { data, loading, error, refetch } = useWidgetData(() => fetchRhAgenda(dias), [dias]);

  const eventos = useMemo(
    () => (data?.eventos ?? []).filter((e) => matchFiltro(e.tipo, filtro)),
    [data, filtro],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, RhAgendaEvento[]>();
    for (const e of eventos) {
      const list = map.get(e.data) ?? [];
      list.push(e);
      map.set(e.data, list);
    }
    return [...map.entries()];
  }, [eventos]);

  if (!allowed) {
    return <p className="text-center text-amber-400">Acesso restrito.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/rh" className="hover:text-white">
            RH
          </Link>
          <span>/</span>
          <span>Agenda</span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarClock className="h-6 w-6 text-cyan-400" />
          Agenda
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Aniversários da equipe e dos dependentes, contratos de experiência, vencimento de NR, CNH e
          curso de operador de reach stacker.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <RhCard title="Hoje">
          <p className="text-3xl font-bold tabular-nums text-cyan-300">{data?.resumo.hoje ?? "—"}</p>
        </RhCard>
        <RhCard title="Próximos 7 dias">
          <p className="text-3xl font-bold tabular-nums text-amber-200">
            {data?.resumo.proximos7 ?? "—"}
          </p>
        </RhCard>
        <RhCard title="Vencidos (30 dias)">
          <p className="text-3xl font-bold tabular-nums text-red-300">
            {data?.resumo.vencidos ?? "—"}
          </p>
        </RhCard>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([30, 90, 365] as const).map((n) => (
          <Button
            key={n}
            size="sm"
            variant={dias === n ? "default" : "outline"}
            onClick={() => setDias(n)}
          >
            {n === 365 ? "12 meses" : `${n} dias`}
          </Button>
        ))}
        <span className="mx-2 h-4 w-px bg-white/10" />
        {(
          [
            ["todos", "Todos"],
            ["aniversarios", "Aniversários"],
            ["contratos", "Contratos"],
            ["vencimentos", "Vencimentos"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={filtro === id ? "default" : "outline"}
            onClick={() => setFiltro(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando agenda…</p>
      ) : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar a agenda" onRetry={refetch} />
      ) : null}
      {!loading && !error && eventos.length === 0 ? (
        <RhCard title="Nenhum evento neste período">
          <p className="text-sm text-zinc-400">
            Cadastre nascimento, familiares, NRs e o curso de reach stacker na ficha do colaborador.
            Contratos CLT entram automaticamente (45 e 90 dias após a admissão).
          </p>
          <Link
            href="/rh/colaboradores"
            className="mt-3 inline-block text-sm font-semibold text-cyan-300 hover:underline"
          >
            Abrir colaboradores →
          </Link>
        </RhCard>
      ) : null}

      {!loading && !error
        ? grouped.map(([dataRef, items]) => (
            <div key={dataRef} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                {formatDate(dataRef)}
              </h2>
              <div className="space-y-2">
                {items.map((e) => (
                    <Link
                      key={e.id}
                      href={`/rh/colaboradores/${e.colaboradorId}`}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 hover:border-cyan-500/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">{e.titulo}</p>
                        <p className="mt-0.5 text-sm text-zinc-400">{e.descricao}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{TIPO_LABEL[e.tipo]}</Badge>
                        <Badge variant={urgenciaBadge(e.urgencia)}>{diasLabel(e.dias)}</Badge>
                      </div>
                    </Link>
                ))}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}
