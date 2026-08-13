"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Package,
  Truck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchOperacao, postCheckin, type OperacaoDto } from "@/lib/gate/operacao-api";
import { STATE_LABELS } from "@/lib/gate/operacao-states";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
import { toast } from "@/lib/toast";

export default function CheckinPage({ params }: { params: { protocolo: string } }) {
  const router = useRouter();
  const protocolo = decodeURIComponent(params.protocolo);
  const [operacao, setOperacao] = useState<OperacaoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void fetchOperacao(protocolo)
      .then(setOperacao)
      .catch(() => {
        toast.error("Operação não encontrada.");
        router.push("/operador/portaria");
      })
      .finally(() => setLoading(false));
  }, [protocolo, router]);

  async function confirmarCheckin() {
    setConfirming(true);
    try {
      await postCheckin(protocolo);
      toast.success("Check-in realizado! Inicie a vistoria fotográfica.");
      router.push(`/operador/portaria/checkin/${encodeURIComponent(protocolo)}/vistoria`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao fazer check-in.");
      setConfirming(false);
    }
  }

  if (loading || !operacao) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const podeCheckin = operacao.state === "AGUARDANDO_CHEGADA";

  return (
    <div className="space-y-6 p-4 pb-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-slate-400"
        onClick={() => router.push("/operador/portaria")}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
      </Button>

      <div className="pt-2 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <Truck className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Unidade Identificada</h1>
        <p className="mt-1 text-sm text-slate-400">Confirme os dados antes da vistoria</p>
      </div>

      <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <span className="text-xs uppercase tracking-wider text-slate-500">Protocolo</span>
          <span className="font-bold text-[var(--accent)]">{operacao.protocolo}</span>
        </div>
        <DataRow icon={Package} label="Contêiner" value={operacao.containerNumero} />
        <DataRow
          icon={Package}
          label="Tipo/Tamanho"
          value={
            formatTipoTamanhoContainerLabel(operacao.containerTipo, operacao.containerTamanho) ??
            "—"
          }
        />
        <DataRow icon={Package} label="Situação" value={operacao.containerSituacao} />
        <DataRow icon={Truck} label="Placa" value={operacao.placa} />
        <DataRow icon={User} label="Motorista" value={operacao.motoristaNome} />
        <DataRow icon={User} label="Transportadora" value={operacao.transportadoraNome} />
        <DataRow icon={User} label="Cliente" value={operacao.clienteNome} />
        <DataRow icon={Package} label="Operação" value={operacao.tipoOperacao} />
        <div data-testid="status-badge" className="hidden">
          {operacao.state}
        </div>
      </div>

      {!podeCheckin && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-400">Esta unidade já foi identificada</p>
            <p className="mt-1 text-xs text-slate-400">
              Estado atual: {STATE_LABELS[operacao.state]}
            </p>
            {(operacao.state === "CHECKIN_PORTARIA" ||
              operacao.state === "VISTORIA_FOTOGRAFICA") && (
              <Button
                type="button"
                variant="link"
                className="mt-2 h-auto p-0 text-[var(--accent)]"
                onClick={() =>
                  router.push(
                    `/operador/portaria/checkin/${encodeURIComponent(protocolo)}/vistoria`,
                  )
                }
              >
                Continuar vistoria →
              </Button>
            )}
          </div>
        </div>
      )}

      <Button
        type="button"
        data-testid="confirm-checkin-btn"
        className="h-12 w-full text-base"
        onClick={() => void confirmarCheckin()}
        disabled={confirming || !podeCheckin}
      >
        {confirming ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Confirmando...
          </>
        ) : (
          <>
            Confirmar Check-in e Iniciar Vistoria <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  );
}

function DataRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm text-slate-400">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="text-right text-sm font-medium text-white">{value}</span>
    </div>
  );
}
