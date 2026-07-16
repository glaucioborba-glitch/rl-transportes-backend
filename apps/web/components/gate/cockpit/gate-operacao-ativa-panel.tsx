"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  GateContainerSituacao,
  GateDespachoItem,
  GateFilaChegadaItem,
  GateOperacaoAtivaItem,
} from "@/lib/gate/gate-cockpit-types";
import {
  buildYardFlowColumns,
  formatElapsedLabel,
  formatHoraChegada,
  type YardFlowCard,
  type YardFlowColumnId,
} from "@/lib/gate/yard-flow";
import { ContainerNumber } from "@/components/ui/container-number";
import { cn } from "@/lib/utils";

type Props = {
  fila: GateFilaChegadaItem[];
  operacao: GateOperacaoAtivaItem[];
  despacho: GateDespachoItem[];
};

type ColumnConfig = {
  id: YardFlowColumnId;
  title: string;
  dotClass: string;
  borderClass: string;
  timerSuffix: string;
};

const COLUMNS: ColumnConfig[] = [
  {
    id: "chegada",
    title: "Chegada no Pátio",
    dotClass: "bg-cyan-500",
    borderClass: "border-l-cyan-500",
    timerSuffix: "no pátio",
  },
  {
    id: "liberado",
    title: "Liberado para Baixa/Coleta",
    dotClass: "bg-amber-500",
    borderClass: "border-l-amber-500",
    timerSuffix: "aguardando",
  },
  {
    id: "em_operacao",
    title: "Em Operação",
    dotClass: "bg-green-500",
    borderClass: "border-l-green-500",
    timerSuffix: "operando",
  },
  {
    id: "pronto_saida",
    title: "Pronto para Saída",
    dotClass: "bg-purple-500",
    borderClass: "border-l-purple-500",
    timerSuffix: "aguardando saída",
  },
];

function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
}

function SituacaoBadge({ situacao }: { situacao: GateContainerSituacao }) {
  const cheio = situacao === "CHEIO";
  return (
    <Badge
      variant="neutral"
      className={cn(
        "text-xs",
        cheio
          ? "border-green-500/30 bg-green-500/15 text-green-400"
          : "border-sky-500/30 bg-sky-500/15 text-sky-400",
      )}
    >
      {cheio ? "Cheio" : "Vazio"}
    </Badge>
  );
}

function YardFlowCardView({
  card,
  column,
  pulse,
}: {
  card: YardFlowCard;
  column: ColumnConfig;
  pulse?: boolean;
}) {
  const timerLabel = formatElapsedLabel(card.referenciaEm, column.timerSuffix);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-4 border-l-4",
        column.borderClass,
        pulse && "animate-pulse-slow border-green-500/30",
      )}
    >
      <ContainerNumber value={card.container} showLabel className="gap-0" />

      {card.tipoTamanho ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{card.tipoTamanho}</span>
          {card.situacao ? <SituacaoBadge situacao={card.situacao} /> : null}
        </div>
      ) : null}

      <div className="text-sm">
        <p className="font-medium">{card.placa ?? "—"}</p>
        <p className="text-muted-foreground">{card.motorista ?? "—"}</p>
      </div>

      <p className="text-xs text-muted-foreground">{card.empresa}</p>

      <div className="flex items-center gap-1 text-sm">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">{timerLabel}</span>
      </div>

      {column.id === "chegada" && card.chegadaTimestamp ? (
        <p className="text-xs text-muted-foreground">Chegou às {formatHoraChegada(card.chegadaTimestamp)}</p>
      ) : null}

      {column.id === "liberado" ? (
        <p className="text-xs text-muted-foreground">
          {card.empilhadeira ? (
            <>Empilhadeira: {card.empilhadeira}</>
          ) : (
            <span className="text-red-400">Sem empilhadeira</span>
          )}
        </p>
      ) : null}

      {column.id === "liberado" && card.slotBaia ? (
        <p className="text-xs text-muted-foreground">Posição: {card.slotBaia}</p>
      ) : null}

      {column.id === "em_operacao" ? (
        <>
          {card.empilhadeira ? (
            <p className="text-xs text-muted-foreground">
              {card.empilhadeira}
              {card.operadorEmpilhadeira ? ` — ${card.operadorEmpilhadeira}` : ""}
            </p>
          ) : null}
          {card.operacaoTipo ? (
            <Badge
              className={cn(
                "self-start border text-xs",
                card.operacaoTipo === "BAIXA"
                  ? "border-green-500/40 bg-green-500/20 text-green-400"
                  : "border-sky-500/40 bg-sky-500/20 text-sky-400",
              )}
            >
              {card.operacaoTipo === "BAIXA" ? "⚡ BAIXANDO" : "⚡ COLETANDO"}
            </Badge>
          ) : null}
        </>
      ) : null}

      {column.id === "pronto_saida" && card.pdfGerado ? (
        <Badge
          variant="neutral"
          className="self-start border-purple-500/30 bg-purple-500/15 text-xs text-purple-300"
        >
          PDF ✓
        </Badge>
      ) : null}
    </div>
  );
}

function YardFlowColumn({
  config,
  cards,
}: {
  config: ColumnConfig;
  cards: YardFlowCard[];
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-[#0b1018]/60 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-white">
          <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
          {config.title}
        </h3>
        <span className="text-2xl font-bold text-primary">{cards.length}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {cards.length ? (
          cards.map((card) => (
            <YardFlowCardView
              key={card.id}
              card={card}
              column={config}
              pulse={config.id === "em_operacao"}
            />
          ))
        ) : (
          <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-muted-foreground">
            Nenhum caminhão nesta fase.
          </div>
        )}
      </div>
    </div>
  );
}

export function GateOperacaoAtivaPanel({ fila, operacao, despacho }: Props) {
  useMinuteTick();

  const colunas = useMemo(
    () => buildYardFlowColumns(fila, operacao, despacho),
    [fila, operacao, despacho],
  );

  const total =
    colunas.chegada.length +
    colunas.liberado.length +
    colunas.em_operacao.length +
    colunas.pronto_saida.length;

  if (!total) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma movimentação ativa no terminal neste momento.
      </p>
    );
  }

  return (
    <div className="grid h-[calc(100vh-180px)] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((config) => (
        <YardFlowColumn key={config.id} config={config} cards={colunas[config.id]} />
      ))}
    </div>
  );
}
