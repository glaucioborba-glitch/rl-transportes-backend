"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ApiError,
  criarSolicitacaoV2,
  criarSolicitacaoV2ComAnexos,
  type CreateSolicitacaoV2Payload,
  type TipoOperacaoSolicitacaoIntent,
} from "@/lib/api/portal-client";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatPhoneBr } from "@/lib/nfse/cliente-fiscal";
import { toast } from "@/lib/toast";
import { useTenantTurnos } from "@/hooks/use-tenant-turnos";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { intentLabel, intentUsesBookingDeadline, intentUsesFlFrete, intentUsesPrevisaoRetirada, optionalDateTimeLocalToIso } from "@/lib/solicitacao-intent";
import {
  ContainerIsoInput,
  ContainerRefrigeradoSelect,
  ContainerStatusSelect,
  ContainerTamanhoSelect,
  ContainerTipoSelect,
  findPortalTipo,
} from "@/components/portal/container-form-fields";
import { stripContainerISO } from "@/utils/containerFormatter";
import { usePortalTiposContainer } from "@/hooks/use-portal-tipos-container";
import { formatTamanhoContainerDisplay, normalizeTamanhoContainer } from "@/lib/cadastros/tipo-container-tamanhos";

type TipoCaminhao = "LS" | "RODOTREM";

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

function emptyContainer(ordem: number): ContainerDraft {
  return {
    unidade: "",
    booking: "",
    processo: "",
    tamanho: "",
    tipo: "",
    status: "CHEIO",
    lacre: "",
    refrigerado: false,
    setPoint: "",
    ordem,
  };
}

export type SolicitacaoFormModalProps = {
  open: boolean;
  intent: TipoOperacaoSolicitacaoIntent | null;
  onClose: () => void;
  onCreated?: () => void;
};

export function SolicitacaoFormModal({ open, intent, onClose, onCreated }: SolicitacaoFormModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tipoCaminhao, setTipoCaminhao] = useState<TipoCaminhao>("LS");

  const [nomeMotorista, setNomeMotorista] = useState("");
  const [cpfMotorista, setCpfMotorista] = useState("");
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta01, setPlacaCarreta01] = useState("");
  const [placaCarreta02, setPlacaCarreta02] = useState("");

  const [localOrigem, setLocalOrigem] = useState("");
  const [localDestino, setLocalDestino] = useState("");

  const [containers, setContainers] = useState<ContainerDraft[]>([emptyContainer(1)]);

  const [dataRef, setDataRef] = useState("");
  const { turnos } = useTenantTurnos();
  const [turno, setTurno] = useState("");
  const [atendimentoEspecial, setAtendimentoEspecial] = useState(false);
  const [atendimentoEspecialTexto, setAtendimentoEspecialTexto] = useState("");

  const [solNome, setSolNome] = useState("");
  const [solTelefone, setSolTelefone] = useState("");
  const [solEmail, setSolEmail] = useState("");

  const [files, setFiles] = useState<File[]>([]);

  const [previsaoRetirada, setPrevisaoRetirada] = useState("");
  const [bookingDeadline, setBookingDeadline] = useState("");

  const pessoa = usePessoaAutorizadaStore((s) => s.pessoa);
  const user = usePortalClienteAuthStore((s) => s.user);

  const isFrotaFL = useMemo(() => intentUsesFlFrete(intent), [intent]);
  const showPrevisaoRetirada = useMemo(() => intentUsesPrevisaoRetirada(intent), [intent]);
  const showBookingDeadline = useMemo(() => intentUsesBookingDeadline(intent), [intent]);
  const containerCount = isFrotaFL || tipoCaminhao === "LS" ? 1 : 2;
  const { tipos: tiposContainer, loading: loadingTipos } = usePortalTiposContainer(open);

  const label = useMemo(() => intentLabel(intent), [intent]);

  useEffect(() => {
    if (!turnos.length) return;
    setTurno((prev) => (prev && turnos.some((t) => t.id === prev) ? prev : turnos[0].id));
  }, [turnos]);

  useEffect(() => {
    if (!open) return;
    if (pessoa) {
      setSolNome(pessoa.nome);
      setSolEmail(pessoa.email);
      if (pessoa.telefone) setSolTelefone(formatPhoneBr(pessoa.telefone));
    } else if (user?.email) {
      setSolEmail(user.email);
    }
  }, [open, pessoa, user?.email]);

  useEffect(() => {
    if (isFrotaFL) setTipoCaminhao("LS");
  }, [isFrotaFL, intent, open]);

  useEffect(() => {
    if (tipoCaminhao === "LS" || isFrotaFL) {
      setContainers((prev) => {
        const first = prev[0] ?? emptyContainer(1);
        return [{ ...first, ordem: 1 }];
      });
    } else {
      setContainers((prev) => {
        const a = prev[0] ?? emptyContainer(1);
        const b = prev[1] ?? emptyContainer(2);
        return [
          { ...a, ordem: 1 },
          { ...b, ordem: 2 },
        ];
      });
    }
  }, [tipoCaminhao, isFrotaFL]);

  function resetForm() {
    setTipoCaminhao("LS");
    setNomeMotorista("");
    setCpfMotorista("");
    setPlacaCavalo("");
    setPlacaCarreta01("");
    setPlacaCarreta02("");
    setLocalOrigem("");
    setLocalDestino("");
    setContainers([emptyContainer(1)]);
    setDataRef("");
    setTurno(turnos[0]?.id ?? "MANHA");
    setAtendimentoEspecial(false);
    setAtendimentoEspecialTexto("");
    setFiles([]);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function updateContainer(i: number, patch: Partial<ContainerDraft>) {
    setContainers((rows) => {
      const next = [...rows];
      const merged = { ...next[i], ...patch };
      if (patch.tipo !== undefined) {
        const tipo = findPortalTipo(tiposContainer, patch.tipo);
        const tamanhoOk = tipo?.tamanhos.some(
          (t) => normalizeTamanhoContainer(t) === normalizeTamanhoContainer(merged.tamanho),
        );
        if (!tamanhoOk) merged.tamanho = "";
        if (!tipo?.tomadaReefer) {
          merged.refrigerado = false;
          merged.setPoint = "";
        }
      }
      if (patch.status === "VAZIO") merged.lacre = "";
      if (!merged.refrigerado) merged.setPoint = "";
      next[i] = merged;
      return next;
    });
  }

  function buildPayload(): CreateSolicitacaoV2Payload {
    if (!intent) throw new Error("Intent obrigatório");

    const ordens = containers.slice(0, containerCount);
    const payload: CreateSolicitacaoV2Payload = {
      tipoOperacao: intent,
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
              tipoCaminhao,
              placaCavalo: placaCavalo.trim().toUpperCase(),
              placaCarreta01: placaCarreta01.trim().toUpperCase(),
              ...(tipoCaminhao === "RODOTREM"
                ? { placaCarreta02: placaCarreta02.trim().toUpperCase() }
                : {}),
            },
          }
        : {}),
      containers: ordens.map((c) => {
        const setPoint =
          c.refrigerado && c.setPoint.trim() ? Number(c.setPoint.replace(",", ".")) : undefined;
        return {
          unidade: stripContainerISO(c.unidade),
          booking: c.booking.trim(),
          processo: c.processo.trim(),
          tamanho: formatTamanhoContainerDisplay(c.tamanho),
          tipo: c.tipo.trim().toUpperCase(),
          status: c.status,
          lacre: c.status === "CHEIO" ? c.lacre.trim() : undefined,
          refrigerado: c.refrigerado,
          setPoint,
          ordem: c.ordem,
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
      ...(showPrevisaoRetirada
        ? { previsaoRetirada: optionalDateTimeLocalToIso(previsaoRetirada) }
        : {}),
      ...(showBookingDeadline
        ? { bookingDeadline: optionalDateTimeLocalToIso(bookingDeadline) }
        : {}),
    };
    return payload;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intent) return;

    if (intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT" && !localOrigem.trim()) {
      toast.error("Informe o local de origem.");
      return;
    }
    if (intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT" && !localDestino.trim()) {
      toast.error("Informe o local de destino.");
      return;
    }
    if (!isFrotaFL) {
      if (!nomeMotorista.trim() || cpfMotorista.replace(/\D/g, "").length !== 11) {
        toast.error("Informe nome e CPF válido do motorista.");
        return;
      }
    }

    const ordens = containers.slice(0, containerCount);
    for (const c of ordens) {
      if (c.refrigerado) {
        const spRaw = c.setPoint.trim().replace(",", ".");
        const n = Number(spRaw);
        if (spRaw === "" || Number.isNaN(n)) {
          toast.error(`Informe set point numérico no container #${c.ordem} (reefer).`);
          return;
        }
        if (n < -30 || n > 30) {
          toast.error(`Set point deve ficar entre -30 e 30 °C (container #${c.ordem}).`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const body = buildPayload();
      const created = files.length
        ? await criarSolicitacaoV2ComAnexos(body, files)
        : await criarSolicitacaoV2(body);
      toast.success(files.length ? "Solicitação registrada com anexos." : "Solicitação registrada.");
      handleClose();
      onCreated?.();
      router.push(`/portal/solicitacoes/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const selectCls =
    "flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 text-sm text-white";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-h-[92vh] w-[min(1440px,95vw)] max-w-[min(1440px,95vw)] overflow-y-auto sm:max-w-[min(1440px,95vw)]">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {isFrotaFL
              ? "Transporte Frota FL — caminhão LS (1 contêiner). Informe endereço e dados operacionais."
              : "Frota do cliente — escolha LS ou Rodotrem e informe os dados do motorista."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT" ? (
            <Card className="border-white/10 bg-black/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Local de origem</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Endereço ou referência de coleta"
                  value={localOrigem}
                  onChange={(e) => setLocalOrigem(e.target.value)}
                  required
                  className="bg-black/40"
                />
              </CardContent>
            </Card>
          ) : null}

          {intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT" ? (
            <Card className="border-white/10 bg-black/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Local de destino</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Endereço ou referência de entrega"
                  value={localDestino}
                  onChange={(e) => setLocalDestino(e.target.value)}
                  required
                  className="bg-black/40"
                />
              </CardContent>
            </Card>
          ) : null}

          {showPrevisaoRetirada ? (
            <Card className="border-white/10 bg-black/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Previsão de retirada (opcional)</CardTitle>
                <CardDescription className="text-slate-400">
                  Informar a previsão nos ajuda a posicionar seu contêiner para uma saída mais rápida.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  type="datetime-local"
                  value={previsaoRetirada}
                  onChange={(e) => setPrevisaoRetirada(e.target.value)}
                  className="bg-black/40"
                />
              </CardContent>
            </Card>
          ) : null}

          {showBookingDeadline ? (
            <Card className="border-white/10 bg-black/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Deadline do navio / booking (opcional)</CardTitle>
                <CardDescription className="text-slate-400">
                  Data-limite de embarque ou booking — usada para priorizar posicionamento no pátio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  type="datetime-local"
                  value={bookingDeadline}
                  onChange={(e) => setBookingDeadline(e.target.value)}
                  className="bg-black/40"
                />
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-white/10 bg-black/25">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Transporte</CardTitle>
              <CardDescription>
                {isFrotaFL
                  ? "Frota FL — tipo de caminhão fixo em LS."
                  : "Motorista, CPF, tipo de caminhão e placas."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {!isFrotaFL ? (
                <>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-slate-500">Nome do motorista</label>
                    <Input
                      value={nomeMotorista}
                      onChange={(e) => setNomeMotorista(e.target.value)}
                      required
                      className="bg-black/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">CPF (apenas dígitos)</label>
                    <Input
                      value={cpfMotorista}
                      onChange={(e) => setCpfMotorista(e.target.value)}
                      required
                      minLength={11}
                      className="bg-black/40"
                    />
                  </div>
                </>
              ) : null}
              <div className={isFrotaFL ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-xs text-slate-500">Tipo de caminhão</label>
                <select
                  className={selectCls}
                  value={tipoCaminhao}
                  onChange={(e) => setTipoCaminhao(e.target.value as TipoCaminhao)}
                  disabled={isFrotaFL}
                >
                  <option value="LS">LS (1 contêiner)</option>
                  {!isFrotaFL ? <option value="RODOTREM">Rodotrem (2 contêineres)</option> : null}
                </select>
              </div>
              {!isFrotaFL ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Placa cavalo</label>
                    <Input
                      value={placaCavalo}
                      onChange={(e) => setPlacaCavalo(e.target.value)}
                      required
                      className="bg-black/40 uppercase"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Placa carreta 01</label>
                    <Input
                      value={placaCarreta01}
                      onChange={(e) => setPlacaCarreta01(e.target.value)}
                      required
                      className="bg-black/40 uppercase"
                    />
                  </div>
                  {tipoCaminhao === "RODOTREM" ? (
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Placa carreta 02</label>
                      <Input
                        value={placaCarreta02}
                        onChange={(e) => setPlacaCarreta02(e.target.value)}
                        required
                        className="bg-black/40 uppercase"
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>

          {containers.slice(0, containerCount).map((c, idx) => (
            <Card key={c.ordem} className="border-white/10 bg-black/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Contêiner #{c.ordem}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Unidade / ISO</label>
                  <ContainerIsoInput
                    value={c.unidade}
                    onChange={(v) => updateContainer(idx, { unidade: v })}
                    required
                    className="bg-black/40 font-mono"
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
                  <label className="mb-1 block text-xs text-slate-500">Tipo</label>
                  <ContainerTipoSelect
                    value={c.tipo}
                    onChange={(v) => updateContainer(idx, { tipo: v })}
                    required
                    selectClassName={selectCls}
                    tipos={tiposContainer}
                    disabled={loadingTipos}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Tamanho</label>
                  <ContainerTamanhoSelect
                    value={c.tamanho}
                    onChange={(v) => updateContainer(idx, { tamanho: v })}
                    required
                    selectClassName={selectCls}
                    tamanhos={findPortalTipo(tiposContainer, c.tipo)?.tamanhos ?? []}
                    disabled={!c.tipo}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Status</label>
                  <ContainerStatusSelect
                    value={c.status}
                    onChange={(v) => updateContainer(idx, { status: v as "CHEIO" | "VAZIO" })}
                    selectClassName={selectCls}
                  />
                </div>
                {c.status === "CHEIO" ? (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-slate-500">Lacre</label>
                    <Input
                      value={c.lacre}
                      onChange={(e) => updateContainer(idx, { lacre: e.target.value })}
                      required
                      className="bg-black/40"
                    />
                  </div>
                ) : null}
                {findPortalTipo(tiposContainer, c.tipo)?.tomadaReefer ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">
                        Conectar à tomada reefer?
                      </label>
                      <ContainerRefrigeradoSelect
                        value={c.refrigerado}
                        onChange={(v) => updateContainer(idx, { refrigerado: v })}
                        selectClassName={selectCls}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Sim = diária de energia (premium). Não = só armazenagem. Pode solicitar
                        tomada depois, durante a estadia.
                      </p>
                    </div>
                    {c.refrigerado ? (
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">Set point (°C)</label>
                        <Input
                          type="number"
                          step="0.1"
                          min={-30}
                          max={30}
                          value={c.setPoint}
                          onChange={(e) => updateContainer(idx, { setPoint: e.target.value })}
                          required
                          className="bg-black/40"
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </CardContent>
            </Card>
          ))}

          <Card className="border-white/10 bg-black/25">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Agendamento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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
                  onChange={(e) => setTurno(e.target.value)}
                  required
                >
                  {turnos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.inicio}–{t.fim})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="atesp-modal"
                  checked={atendimentoEspecial}
                  onChange={(e) => setAtendimentoEspecial(e.target.checked)}
                />
                <label htmlFor="atesp-modal" className="text-sm text-slate-300">
                  Atendimento especial (prioritário)
                </label>
              </div>
              {atendimentoEspecial ? (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">Detalhes (opcional)</label>
                  <Input
                    value={atendimentoEspecialTexto}
                    onChange={(e) => setAtendimentoEspecialTexto(e.target.value)}
                    className="bg-black/40"
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/25">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Contato do solicitante</CardTitle>
              {pessoa && user?.cpfCnpj ? (
                <CardDescription>
                  Responsável: {pessoa.nome} (CNPJ/CPF {formatCpfCnpjBr(user.cpfCnpj)})
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
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
                  onChange={(e) => setSolTelefone(e.target.value)}
                  required
                  className="bg-black/40"
                />
              </div>
              <div>
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

          <Card className="border-white/10 bg-black/25">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Anexos (opcional)</CardTitle>
              <CardDescription>JPG ou PDF, até 5MB por arquivo. Você pode anexar depois na solicitação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="file"
                accept=".jpg,.jpeg,.pdf,image/jpeg,application/pdf"
                multiple
                onChange={(e) => {
                  const list = e.target.files ? Array.from(e.target.files) : [];
                  setFiles(list);
                }}
                className="bg-black/40"
              />
              {files.length ? (
                <ul className="list-inside list-disc text-xs text-slate-400">
                  {files.map((f) => (
                    <li key={f.name + f.size}>
                      {f.name} · {(f.size / 1024).toFixed(0)} KB
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Nenhum arquivo selecionado.</p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar solicitação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
