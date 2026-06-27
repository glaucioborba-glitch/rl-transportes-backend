"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, RefreshCw } from "lucide-react";
import { AgendarRetiradaModal } from "@/components/portal/patiamento/agendar-retirada-modal";
import { PortalAgendamentoGuard } from "@/components/portal/portal-agendamento-guard";
import { StackColumn } from "@/components/portal/patiamento/stack-column";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { Button } from "@/components/ui/button";
import { MOCK_PILHAS } from "@/lib/patiamento/mock-pilhas";
import type { ContainerPilha, Pilha, PilhasResponse } from "@/lib/patiamento/types";
import { toast } from "@/lib/toast";
import { useTosSocket } from "@/lib/realtime/use-tos-socket";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";

export default function PatiamentoPage() {
  const [pilhas, setPilhas] = useState<Pilha[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<ContainerPilha | null>(null);
  const [selectedPilhaCodigo, setSelectedPilhaCodigo] = useState("");
  const [exigeRemocaoModal, setExigeRemocaoModal] = useState(false);

  const loadPilhas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cliente/pilhas", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar pilhas");
      const data = (await res.json()) as PilhasResponse;
      setPilhas(data.pilhas);
      setAtualizadoEm(data.atualizadoEm);
    } catch {
      setPilhas(MOCK_PILHAS.pilhas);
      setAtualizadoEm(MOCK_PILHAS.atualizadoEm);
      toast.error("Usando dados de demonstração — API indisponível.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPilhas();
  }, [loadPilhas]);

  const clienteId = usePortalClienteAuthStore((s) => s.user?.clienteId ?? "");

  useTosSocket({
    namespace: "/ws/yard",
    event: "yard_updated",
    enabled: Boolean(clienteId),
    query: clienteId ? { clienteId } : undefined,
    onEvent: () => {
      void loadPilhas();
    },
  });

  const totalContainers = useMemo(
    () => pilhas.reduce((acc, p) => acc + p.containers.length, 0),
    [pilhas],
  );

  const handleAgendarClick = useCallback(
    (pilha: Pilha, containerId: string, exigeShifting: boolean) => {
      const container = pilha.containers.find((c) => c.id === containerId) ?? null;
      setSelectedContainer(container);
      setSelectedPilhaCodigo(pilha.codigo);
      setExigeRemocaoModal(exigeShifting);
      setModalOpen(true);
    },
    [],
  );

  const handleConfirmAgendamento = useCallback(() => {
    if (!selectedContainer) return;
    setModalOpen(false);
    toast.success(
      exigeRemocaoModal
        ? `OS de preparação (shifting) criada para ${selectedContainer.numero}.`
        : `Retirada agendada para ${selectedContainer.numero}.`,
    );
    setSelectedContainer(null);
  }, [selectedContainer, exigeRemocaoModal]);

  return (
    <PortalAgendamentoGuard>
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SectionTitle
          title="Visão de Pátio — Meus Contêineres"
          description="Pilhas lógicas do depot. Contêineres no topo estão livres para retirada; unidades abaixo exigem shifting."
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void loadPilhas()}
        >
          <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
          Atualizar
        </Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-slate-500">Pilhas</p>
          <p className="text-2xl font-bold text-white">{pilhas.length}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-slate-500">Contêineres</p>
          <p className="text-2xl font-bold text-white">{totalContainers}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-slate-500">Atualizado</p>
          <p className="text-sm font-medium text-slate-300">
            {atualizadoEm ? new Date(atualizadoEm).toLocaleString("pt-BR") : "—"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[20rem] items-center justify-center text-slate-400">
          Carregando visão de pátio…
        </div>
      ) : pilhas.length === 0 ? (
        <div className="flex min-h-[20rem] flex-col items-center justify-center gap-3 text-slate-400">
          <Layers className="h-10 w-10 opacity-40" />
          <p>Nenhuma pilha encontrada para sua conta.</p>
        </div>
      ) : (
        <>
          {/* Desktop: pilhas lado a lado com scroll horizontal */}
          <div className="hidden md:block">
            <div className="overflow-x-auto pb-4">
              <div className="flex min-w-min items-end justify-start gap-10 px-2">
                {pilhas.map((pilha) => (
                  <StackColumn
                    key={pilha.id}
                    pilha={pilha}
                    onAgendar={(containerId, exigeShifting) =>
                      handleAgendarClick(pilha, containerId, exigeShifting)
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Mobile: pilhas em lista vertical */}
          <div className="flex flex-col gap-12 md:hidden">
            {pilhas.map((pilha) => (
              <StackColumn
                key={pilha.id}
                pilha={pilha}
                onAgendar={(containerId, exigeShifting) =>
                  handleAgendarClick(pilha, containerId, exigeShifting)
                }
              />
            ))}
          </div>
        </>
      )}

      <AgendarRetiradaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        container={selectedContainer}
        pilhaCodigo={selectedPilhaCodigo}
        exigeRemocao={exigeRemocaoModal}
        onConfirm={handleConfirmAgendamento}
      />
    </main>
    </PortalAgendamentoGuard>
  );
}
