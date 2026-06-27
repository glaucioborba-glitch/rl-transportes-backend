"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OperationDialogHeader } from "@/components/shared/operation-identity";
import {
  ContainerIsoInput,
  ContainerTamanhoSelect,
  ContainerTipoSelect,
} from "@/components/portal/container-form-fields";
import {
  ApiError,
  atualizarSolicitacaoPortal,
  fetchSolicitacao,
  type SolicitacaoRow,
  type TipoOperacaoSolicitacaoIntent,
  type UpdatePortalSolicitacaoPayload,
} from "@/lib/api/portal-client";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatPhoneBr } from "@/lib/nfse/cliente-fiscal";
import { intentLabel, intentUsesFlFrete } from "@/lib/solicitacao-intent";
import { toast } from "@/lib/toast";
import { formatContainerISO } from "@/utils/containerFormatter";
import { isJanelaExecucao } from "@/utils/janelaExecucao";

type ContainerDraft = {
  unidade: string;
  booking: string;
  processo: string;
  tamanho: string;
  tipo: string;
  status: "CHEIO" | "VAZIO";
  lacre: string;
  refrigerado: boolean;
  setPoint: string;
  ordem: number;
};

export function SolicitacaoEditModal({
  open,
  solicitacaoId,
  onClose,
  onUpdated,
}: {
  open: boolean;
  solicitacaoId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [intent, setIntent] = useState<TipoOperacaoSolicitacaoIntent | null>(null);
  const [originalDataRef, setOriginalDataRef] = useState("");
  const [originalTurno, setOriginalTurno] = useState<"MANHA" | "TARDE">("MANHA");

  const [localOrigem] = useState("");
  const [localDestino] = useState("");
  const [containers, setContainers] = useState<ContainerDraft[]>([]);
  const [dataRef, setDataRef] = useState("");
  const [turno, setTurno] = useState<"MANHA" | "TARDE">("MANHA");
  const [atendimentoEspecial, setAtendimentoEspecial] = useState(false);
  const [atendimentoEspecialTexto, setAtendimentoEspecialTexto] = useState("");

  const [nomeMotorista, setNomeMotorista] = useState("");
  const [cpfMotorista, setCpfMotorista] = useState("");
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta01, setPlacaCarreta01] = useState("");
  const [placaCarreta02, setPlacaCarreta02] = useState("");

  const [solNome, setSolNome] = useState("");
  const [solTelefone, setSolTelefone] = useState("");
  const [solEmail, setSolEmail] = useState("");

  const isFrotaFL = useMemo(() => intentUsesFlFrete(intent), [intent]);
  const selectCls =
    "flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 text-sm text-white";

  useEffect(() => {
    if (!open || !solicitacaoId) return;
    setLoading(true);
    void fetchSolicitacao(solicitacaoId)
      .then((row: SolicitacaoRow) => {
        setProtocolo(row.protocolo);
        setIntent((row.tipoOperacao as TipoOperacaoSolicitacaoIntent) ?? null);
        const ag = row.agendamentoSolicitacao;
        const dateStr = ag?.dataRef ? String(ag.dataRef).slice(0, 10) : "";
        setDataRef(dateStr);
        setOriginalDataRef(dateStr);
        const t = (ag?.turno as "MANHA" | "TARDE") ?? "MANHA";
        setTurno(t);
        setOriginalTurno(t);
        setAtendimentoEspecial(Boolean(ag?.atendimentoEspecial));
        setAtendimentoEspecialTexto(ag?.atendimentoEspecialTexto ?? "");

        setContainers(
          (row.containersSolicitacao ?? []).map((c) => ({
            unidade: formatContainerISO(c.unidade),
            booking: c.booking ?? "",
            processo: c.processo ?? "",
            tamanho: c.tamanho ?? "",
            tipo: c.tipo ?? "",
            status: c.status as "CHEIO" | "VAZIO",
            lacre: c.lacre ?? "",
            refrigerado: Boolean(c.refrigerado),
            setPoint: c.setPoint != null ? String(c.setPoint) : "",
            ordem: c.ordem,
          })),
        );

        const tr = row.transporteSolicitacao;
        if (tr) {
          setNomeMotorista(tr.nomeMotorista ?? "");
          setCpfMotorista(formatCpfCnpjBr(tr.cpfMotorista ?? ""));
          setPlacaCavalo(tr.placaCavalo ?? "");
          setPlacaCarreta01(tr.placaCarreta01 ?? "");
          setPlacaCarreta02(tr.placaCarreta02 ?? "");
        }

        const sol = row.solicitanteContato;
        if (sol) {
          setSolNome(sol.nome ?? "");
          setSolTelefone(sol.telefone ? formatPhoneBr(sol.telefone) : "");
          setSolEmail(sol.email ?? "");
        }
      })
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : "Erro ao carregar solicitação");
        onClose();
      })
      .finally(() => setLoading(false));
  }, [open, solicitacaoId, onClose]);

  function updateContainer(i: number, patch: Partial<ContainerDraft>) {
    setContainers((rows) => {
      const next = [...rows];
      next[i] = { ...next[i], ...patch };
      if (patch.status === "VAZIO") next[i].lacre = "";
      if (patch.refrigerado === false) next[i].setPoint = "";
      return next;
    });
  }

  function buildPayload(): UpdatePortalSolicitacaoPayload {
    return {
      ...(intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT"
        ? { localOrigem: localOrigem.trim() }
        : {}),
      ...(intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT"
        ? { localDestino: localDestino.trim() }
        : {}),
      ...(!isFrotaFL
        ? {
            transporte: {
              nomeMotorista: nomeMotorista.trim(),
              cpfMotorista: cpfMotorista.replace(/\D/g, ""),
              tipoCaminhao: (containers.length > 1 ? "RODOTREM" : "LS") as "LS" | "RODOTREM",
              placaCavalo: placaCavalo.trim().toUpperCase(),
              placaCarreta01: placaCarreta01.trim().toUpperCase(),
              ...(containers.length > 1
                ? { placaCarreta02: placaCarreta02.trim().toUpperCase() }
                : {}),
            },
          }
        : {}),
      containers: containers.map((c) => {
        const setPoint =
          c.refrigerado && c.setPoint.trim() ? Number(c.setPoint.replace(",", ".")) : undefined;
        return {
          ordem: c.ordem,
          booking: c.booking.trim() || undefined,
          processo: c.processo.trim() || undefined,
          tamanho: c.tamanho.trim(),
          tipo: c.tipo.trim(),
          status: c.status,
          lacre: c.status === "CHEIO" ? c.lacre.trim() || undefined : undefined,
          refrigerado: c.refrigerado,
          setPoint,
        };
      }),
      agendamento: {
        dataRef,
        turno,
        atendimentoEspecial,
        atendimentoEspecialTexto: atendimentoEspecial
          ? atendimentoEspecialTexto.trim() || undefined
          : undefined,
      },
      solicitante: {
        nome: solNome.trim(),
        telefone: solTelefone.trim(),
        email: solEmail.trim().toLowerCase(),
      },
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!solicitacaoId) return;

    const scheduleChanged = dataRef !== originalDataRef || turno !== originalTurno;
    if (
      scheduleChanged &&
      (isJanelaExecucao(originalDataRef) || isJanelaExecucao(dataRef)) &&
      !window.confirm(
        "A solicitação já está na janela de execução, deseja realmente alterar?",
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await atualizarSolicitacaoPortal(solicitacaoId, buildPayload());
      toast.success("Solicitação atualizada.");
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao salvar alterações");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <OperationDialogHeader
          isos={containers.map((c) => c.unidade)}
          protocolo={protocolo || undefined}
          verb="Editar"
          description={
            <p className="text-sm text-slate-500">
              {loading ? "Carregando…" : intentLabel(intent)}
            </p>
          }
        />

        {loading ? (
          <p className="text-sm text-slate-500">Carregando dados…</p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {containers.map((c, idx) => (
              <Card key={c.ordem} className="border-white/10 bg-black/25">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white">Contêiner #{c.ordem}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-slate-500">Contêiner (ISO) — imutável</label>
                    <ContainerIsoInput
                      value={c.unidade}
                      onChange={() => undefined}
                      disabled
                      className="bg-black/30 font-mono opacity-80"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Booking (opcional)</label>
                    <Input
                      value={c.booking}
                      onChange={(e) => updateContainer(idx, { booking: e.target.value })}
                      className="bg-black/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Processo (opcional)</label>
                    <Input
                      value={c.processo}
                      onChange={(e) => updateContainer(idx, { processo: e.target.value })}
                      className="bg-black/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Tamanho</label>
                    <ContainerTamanhoSelect
                      value={c.tamanho}
                      onChange={(v) => updateContainer(idx, { tamanho: v })}
                      required
                      selectClassName={selectCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Tipo</label>
                    <ContainerTipoSelect
                      value={c.tipo}
                      onChange={(v) => updateContainer(idx, { tipo: v })}
                      required
                      selectClassName={selectCls}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border-white/10 bg-black/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Agendamento</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Data</label>
                  <Input
                    type="date"
                    value={dataRef}
                    onChange={(e) => setDataRef(e.target.value)}
                    required
                    className="bg-black/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Turno</label>
                  <select
                    className={selectCls}
                    value={turno}
                    onChange={(e) => setTurno(e.target.value as "MANHA" | "TARDE")}
                  >
                    <option value="MANHA">Manhã</option>
                    <option value="TARDE">Tarde</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {!isFrotaFL ? (
              <Card className="border-white/10 bg-black/25">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white">Transporte</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Motorista</label>
                    <Input
                      value={nomeMotorista}
                      onChange={(e) => setNomeMotorista(e.target.value)}
                      required
                      className="bg-black/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">CPF</label>
                    <Input
                      value={cpfMotorista}
                      onChange={(e) => setCpfMotorista(formatCpfCnpjBr(e.target.value))}
                      required
                      className="bg-black/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Placa cavalo</label>
                    <Input
                      value={placaCavalo}
                      onChange={(e) => setPlacaCavalo(e.target.value.toUpperCase())}
                      required
                      className="bg-black/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Placa carreta 01</label>
                    <Input
                      value={placaCarreta01}
                      onChange={(e) => setPlacaCarreta01(e.target.value.toUpperCase())}
                      required
                      className="bg-black/40"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-white/10 bg-black/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Solicitante</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Nome</label>
                  <Input
                    value={solNome}
                    onChange={(e) => setSolNome(e.target.value)}
                    required
                    className="bg-black/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Telefone</label>
                  <Input
                    value={solTelefone}
                    onChange={(e) => setSolTelefone(formatPhoneBr(e.target.value))}
                    required
                    className="bg-black/40"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">E-mail</label>
                  <Input
                    type="email"
                    value={solEmail}
                    onChange={(e) => setSolEmail(e.target.value)}
                    required
                    className="bg-black/40"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
