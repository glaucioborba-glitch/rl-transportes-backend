"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchOperacao,
  postReconfirmar,
  postRejeitar,
  type OperacaoDto,
} from "@/lib/gate/operacao-api";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
import { toast } from "@/lib/toast";

const MOTIVOS = [
  { value: "CONTAINER_DIVERGENTE", label: "Contêiner não confere" },
  { value: "PLACA_DIVERGENTE", label: "Placa não confere" },
  { value: "MOTORISTA_DIVERGENTE", label: "Motorista não confere" },
  { value: "AVARIA_CRITICA", label: "Avaria crítica impede operação" },
  { value: "FOTOS_ILLEGIVEIS", label: "Fotos ilegíveis — refazer vistoria" },
  { value: "OUTRO", label: "Outro motivo" },
];

export default function ReconfirmarDetailPage({ params }: { params: { protocolo: string } }) {
  const router = useRouter();
  const protocolo = decodeURIComponent(params.protocolo);
  const [operacao, setOperacao] = useState<OperacaoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState({
    containerConfere: false,
    tipoConfere: false,
    situacaoConfere: false,
    placaConfere: false,
    motoristaConfere: false,
    fotosOk: false,
    semAvariasCriticas: false,
  });
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [rejeitando, setRejeitando] = useState(false);

  useEffect(() => {
    void fetchOperacao(protocolo)
      .then(setOperacao)
      .catch(() => {
        toast.error("Vistoria não encontrada.");
        router.push("/operador/gate/reconfirmar");
      })
      .finally(() => setLoading(false));
  }, [protocolo, router]);

  const todasConferidas = Object.values(checklist).every(Boolean);

  async function aprovar() {
    if (!todasConferidas) {
      toast.error("Marque todos os itens do checklist antes de aprovar.");
      return;
    }
    try {
      await postReconfirmar(protocolo, checklist);
      toast.success("Reconfirmado! Gerando RIC...");
      router.push(`/operador/gate/ric/${encodeURIComponent(protocolo)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reconfirmar.");
    }
  }

  async function rejeitar() {
    if (!motivoRejeicao) {
      toast.error("Selecione o motivo da rejeição.");
      return;
    }
    setRejeitando(true);
    try {
      await postRejeitar(protocolo, motivoRejeicao, "RECONFIRMACAO");
      toast.success("Operação rejeitada.");
      router.push("/operador/gate/reconfirmar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao rejeitar.");
    } finally {
      setRejeitando(false);
    }
  }

  if (loading || !operacao) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reconfirmação de Chegada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {protocolo} · Confira os dados da vistoria fotográfica
          </p>
        </div>
        <Badge variant="neutral" className="border-amber-500/30 bg-amber-500/15 text-amber-400">
          Aguardando Reconfirmação
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-bold">Dados da Operação</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Contêiner" value={operacao.containerNumero} />
              <Field
                label="Tipo"
                value={
                  formatTipoTamanhoContainerLabel(
                    operacao.containerTipo,
                    operacao.containerTamanho,
                  ) ?? "—"
                }
              />
              <Field label="Situação" value={operacao.containerSituacao} />
              <Field label="Placa" value={operacao.placa} />
              <Field label="Motorista" value={operacao.motoristaNome} />
              <Field label="Cliente" value={operacao.clienteNome} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-bold">Fotos da Vistoria</h2>
            <div className="grid grid-cols-2 gap-3">
              {operacao.vistoria?.fotos?.map((foto) => (
                <div key={foto.tipo} className="space-y-1">
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={foto.imagem} alt={foto.tipo} className="h-full w-full object-cover" />
                    {foto.ocrResult && (
                      <div
                        className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-xs font-medium ${
                          foto.ocrMatch ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
                        }`}
                      >
                        OCR: {foto.ocrResult} {foto.ocrMatch ? "✓" : "✗"}
                        <span className="ml-1 opacity-75">
                          ({Math.round((foto.ocrConfianca ?? 0) * 100)}% · {foto.ocrProvider ?? "—"})
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    {foto.tipo.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
              ))}
            </div>

            {(operacao.vistoria?.avarias?.length ?? 0) > 0 && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  {operacao.vistoria!.avarias.length} Avaria(s)
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-bold">Checklist de Conferência</h2>
            <div className="space-y-3">
              {(
                [
                  ["containerConfere", "Número do contêiner confere"],
                  ["tipoConfere", "Tipo e tamanho conferem"],
                  ["situacaoConfere", "Situação (cheio/vazio) confere"],
                  ["placaConfere", "Placa do veículo confere"],
                  ["motoristaConfere", "Motorista confere com documento"],
                  ["fotosOk", "Fotos da vistoria estão legíveis"],
                  ["semAvariasCriticas", "Sem avarias críticas que impeçam a operação"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist[key]}
                    onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })}
                    className="h-5 w-5 rounded border-border"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-5">
            <Button
              type="button"
              className="w-full"
              disabled={!todasConferidas}
              onClick={() => void aprovar()}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Reconfirmar e Gerar RIC
            </Button>

            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs text-muted-foreground">Rejeitar operação:</p>
              <select
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione o motivo...</option>
                {MOTIVOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {motivoRejeicao && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full border-red-500/30 text-red-400"
                  disabled={rejeitando}
                  onClick={() => void rejeitar()}
                >
                  <X className="mr-2 h-4 w-4" /> Rejeitar Operação
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
