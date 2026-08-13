"use client";

import { useCallback, useEffect, useState } from "react";
import { GripVertical, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiError,
  staffDispatchAssign,
  staffDispatchBoard,
  type DispatchAgendamentoCard,
  type DispatchBoardResponse,
  type DispatchVeiculo,
  staffDispatchVeiculos,
} from "@/lib/api/staff-client";
import { useTosSocket } from "@/lib/realtime/use-tos-socket";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { buildContainerPrimaryDisplay } from "@/lib/container-display";
import { ContainerPrimaryHeading, ProtocolRefLabel } from "@/components/shared/operation-identity";

function AgendamentoCard({
  item,
  draggable = true,
  className,
}: {
  item: DispatchAgendamentoCard & { status?: string; veiculoPlaca?: string };
  draggable?: boolean;
  className?: string;
}) {
  return (
    <div
      draggable={draggable}
      className={cn(
        "cursor-grab rounded-xl border border-white/10 bg-[#121820] p-3 shadow-md active:cursor-grabbing",
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <ContainerPrimaryHeading
            display={buildContainerPrimaryDisplay([item.numeroIso])}
            size="sm"
          />
          {item.protocolo ? <ProtocolRefLabel protocolo={item.protocolo} className="mt-1" /> : null}
        </div>
        {draggable ? <GripVertical className="h-4 w-4 shrink-0 text-slate-500" /> : null}
      </div>
      <p className="text-xs text-slate-400">
        {item.origem ?? "Depot FL"} → {item.destino ?? "Depot FL"}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {item.dataRef} · {item.turno} · {item.statusCarga}
      </p>
      {item.booking ? (
        <p className="mt-1 text-[11px] text-slate-500">Booking: {item.booking}</p>
      ) : null}
      {item.status ? (
        <span className="mt-2 inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
          {item.status.replace(/_/g, " ")}
        </span>
      ) : null}
      {item.veiculoPlaca ? (
        <p className="mt-1 text-[11px] text-slate-400">Placa: {item.veiculoPlaca}</p>
      ) : null}
    </div>
  );
}

export function DispatchBoard() {
  const [board, setBoard] = useState<DispatchBoardResponse | null>(null);
  const [veiculos, setVeiculos] = useState<DispatchVeiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, v] = await Promise.all([staffDispatchBoard(), staffDispatchVeiculos()]);
      setBoard(b);
      setVeiculos(v);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar dispatch board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useTosSocket({
    namespace: "/ws/dispatch",
    event: "dispatch_updated",
    onEvent: (payload) => {
      const p = payload as { board?: DispatchBoardResponse };
      if (p.board) {
        setBoard(p.board);
        setLoading(false);
      } else {
        void load();
      }
    },
  });

  async function handleDrop(motoristaId: string, agendamentoId: string) {
    const cavalo = veiculos.find((v) => v.tipo === "CAVALO") ?? veiculos[0];
    if (!cavalo) {
      toast.error("Cadastre ao menos um veículo para despacho.");
      return;
    }
    setAssigning(true);
    try {
      await staffDispatchAssign({ agendamentoId, motoristaId, veiculoId: cavalo.id });
      toast.success("Ordem despachada para o motorista.");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao despachar");
    } finally {
      setAssigning(false);
      setDraggingId(null);
    }
  }

  if (loading) {
    return <p className="text-slate-500">Carregando dispatch board…</p>;
  }

  const pendentes = board?.pendentes ?? [];
  const motoristas = board?.motoristas ?? [];

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:overflow-x-auto">
      {/* Backlog */}
      <section className="min-w-[16rem] flex-shrink-0 lg:w-72">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-100">
              <Truck className="h-4 w-4" />
              Pendentes de transporte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendentes.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum agendamento FROTA_FL pendente.</p>
            ) : (
              pendentes.map((item) => (
                <div
                  key={item.agendamentoId}
                  onDragStart={() => setDraggingId(item.agendamentoId)}
                  onDragEnd={() => setDraggingId(null)}
                >
                  <AgendamentoCard item={item} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Motoristas */}
      <div className="flex min-w-0 flex-1 gap-4 overflow-x-auto pb-2">
        {motoristas.length === 0 ? (
          <Card className="min-w-[14rem] flex-1">
            <CardContent className="py-8 text-center text-sm text-slate-500">
              Nenhum motorista disponível cadastrado.
            </CardContent>
          </Card>
        ) : (
          motoristas.map((m) => (
            <section
              key={m.id}
              className={cn(
                "min-w-[14rem] flex-shrink-0 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors",
                draggingId && m.status === "DISPONIVEL" && "ring-2 ring-[var(--accent)]/40",
              )}
              onDragOver={(e) => {
                if (draggingId && m.status === "DISPONIVEL" && !m.ordemAtiva) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId && m.status === "DISPONIVEL" && !m.ordemAtiva) {
                  void handleDrop(m.id, draggingId);
                }
              }}
            >
              <header className="mb-3 border-b border-white/5 pb-2">
                <p className="font-semibold text-white">{m.nome}</p>
                <p className="text-[11px] text-slate-500">{m.telefone}</p>
                <span
                  className={cn(
                    "mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                    m.status === "DISPONIVEL"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-sky-500/20 text-sky-200",
                  )}
                >
                  {m.status.replace(/_/g, " ")}
                </span>
              </header>

              {m.ordemAtiva ? (
                <AgendamentoCard item={m.ordemAtiva} draggable={false} />
              ) : (
                <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
                  {m.status === "DISPONIVEL"
                    ? "Arraste um card do backlog"
                    : "Sem slot livre"}
                </div>
              )}
            </section>
          ))
        )}
      </div>

      {assigning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Button disabled>Despachando…</Button>
        </div>
      ) : null}
    </div>
  );
}
