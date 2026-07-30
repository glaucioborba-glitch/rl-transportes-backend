"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Clock,
  Forklift,
  Loader2,
  Package,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchEquipamentoAtual,
  fetchOperacao,
  postConcluirOperacao,
  postIniciarOperacao,
  type OperacaoDto,
} from "@/lib/gate/operacao-api";
import { STATE_LABELS } from "@/lib/gate/operacao-states";
import { toast } from "@/lib/toast";

export default function OperacaoAtivaDetailPage({ params }: { params: { protocolo: string } }) {
  const router = useRouter();
  const protocolo = decodeURIComponent(params.protocolo);
  const [operacao, setOperacao] = useState<OperacaoDto | null>(null);
  const [equipamento, setEquipamento] = useState<{
    id: string;
    codigo: string;
    marca: string;
    modelo: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    void Promise.all([fetchOperacao(protocolo), fetchEquipamentoAtual()])
      .then(([op, eq]) => {
        setOperacao(op);
        setEquipamento(eq);
      })
      .catch(() => {
        toast.error("Erro ao carregar operação.");
        router.push("/operador/gate/operacao");
      })
      .finally(() => setLoading(false));
  }, [protocolo, router]);

  useEffect(() => {
    if (operacao?.state !== "EM_OPERACAO") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [operacao?.state]);

  async function iniciarOperacao() {
    setIniciando(true);
    try {
      const op = await postIniciarOperacao(protocolo, equipamento?.id);
      setOperacao(op);
      toast.success("Operação iniciada! TAT começou a contar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar operação.");
    } finally {
      setIniciando(false);
    }
  }

  async function concluirOperacao() {
    setConcluindo(true);
    try {
      await postConcluirOperacao(protocolo);
      toast.success("Operação concluída! Motorista liberado para saída.");
      router.push("/operador/gate/operacao");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao concluir operação.");
    } finally {
      setConcluindo(false);
    }
  }

  if (loading || !operacao) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tat =
    operacao.tatInicio && operacao.state === "EM_OPERACAO"
      ? Math.floor((Date.now() - new Date(operacao.tatInicio).getTime()) / 60000)
      : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{protocolo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{STATE_LABELS[operacao.state]}</p>
        </div>
        <Badge variant="neutral">{STATE_LABELS[operacao.state]}</Badge>
      </div>

      {operacao.state === "EM_OPERACAO" && (
        <div className="flex items-center gap-4 rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
          <Clock className="h-8 w-8 text-purple-400" />
          <div>
            <p className="text-sm font-medium text-purple-400">Tempo de Operação (TAT)</p>
            <p className="text-2xl font-bold tabular-nums text-purple-400">{tat} min</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Contêiner</p>
              <p className="font-bold font-mono">{operacao.containerNumero}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Placa</p>
            <p className="font-medium">{operacao.placa}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Forklift className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Equipamento</h2>
        </div>
        {equipamento ? (
          <div>
            <p className="font-bold font-mono">{equipamento.codigo}</p>
            <p className="text-sm text-muted-foreground">
              {equipamento.marca} {equipamento.modelo}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum equipamento vinculado.{" "}
            <a href="/operador/login-equipamento" className="text-primary underline">
              Vincular no login
            </a>
          </p>
        )}
      </div>

      {operacao.state === "LIBERADA_OPERACAO" && (
        <Button
          type="button"
          className="h-14 w-full text-base"
          onClick={() => void iniciarOperacao()}
          disabled={iniciando}
        >
          {iniciando ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Play className="mr-2 h-5 w-5" />
          )}
          Iniciar Operação
        </Button>
      )}

      {operacao.state === "EM_OPERACAO" && (
        <Button
          type="button"
          className="h-14 w-full bg-green-600 text-base hover:bg-green-700"
          onClick={() => void concluirOperacao()}
          disabled={concluindo}
        >
          {concluindo ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-5 w-5" />
          )}
          Concluir Operação — Liberar Motorista
        </Button>
      )}
    </div>
  );
}
