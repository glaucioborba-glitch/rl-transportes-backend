"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  criarSolicitacaoV2,
  criarSolicitacaoV2ComAnexos,
  fetchPortalCatalogoContainer,
  type CreateSolicitacaoV2Payload,
  type PortalPatioSaldoItem,
  type TipoOperacaoSolicitacaoIntent,
} from "@/lib/api/portal-client";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatPhoneBr } from "@/lib/nfse/cliente-fiscal";
import { toast } from "@/lib/toast";
import { useTenantTurnos } from "@/hooks/use-tenant-turnos";
import { resolveAgendamentoTurno } from "@/lib/api/tenant-config-client";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { intentLabel, intentUsesBookingDeadline, intentUsesEstoqueDoCliente, intentUsesFlFrete, intentUsesPrevisaoRetirada, optionalDateTimeLocalToIso } from "@/lib/solicitacao-intent";
import { ContainerEstoqueSearch } from "@/components/portal/container-estoque-search";
import {
  ContainerIsoInput,
  ContainerRefrigeradoSelect,
  ContainerStatusSelect,
  ContainerTamanhoSelect,
  ContainerTipoSelect,
  findPortalTipo,
} from "@/components/portal/container-form-fields";
import { stripContainerISO, formatContainerISO } from "@/utils/containerFormatter";
import { fieldErrorForContainer, parseUnidadeEstoqueError } from "@/lib/solicitacao-estoque-error";
import { usePortalTiposContainer } from "@/hooks/use-portal-tipos-container";
import { usePortalEstoqueCliente } from "@/hooks/use-portal-estoque-cliente";
import { peekPortalSaidaPrefill, clearPortalSaidaPrefill } from "@/lib/portal-saida-prefill";
import { formatTamanhoContainerDisplay, normalizeTamanhoContainer } from "@/lib/cadastros/tipo-container-tamanhos";
import { catalogoContainerHint, patchFromCatalogo } from "@/lib/catalogo-container-iso";
import {
  SOLICITACAO_CARD_C as CARD_C,
  SOLICITACAO_CARD_H as CARD_H,
  SOLICITACAO_FORM_GRID as GRID,
  SOLICITACAO_SELECT_CLS as SELECT_CLS,
  SOLICITACAO_SPAN2 as SPAN2,
} from "@/components/portal/solicitacao-form-layout";
import { useMotoristaCpfAutofill } from "@/hooks/use-motorista-cpf-autofill";

type TipoCaminhao = "LS" | "RODOTREM";

type ContainerDraft = {
  unidade: string;
  booking: string;
  processo: string;
  navio: string;
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
    navio: "",
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
  prefillIso?: string | null;
  onClose: () => void;
  onCreated?: () => void;
};

export function SolicitacaoFormModal({
  open,
  intent,
  prefillIso,
  onClose,
  onCreated,
}: SolicitacaoFormModalProps) {
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
  const [catalogoHints, setCatalogoHints] = useState<Record<number, string>>({});

  const [dataRef, setDataRef] = useState("");
  const { turnos } = useTenantTurnos();
  const [turno, setTurno] = useState("");

  const [solNome, setSolNome] = useState("");
  const [solTelefone, setSolTelefone] = useState("");
  const [solEmail, setSolEmail] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const [unidadeFieldErrors, setUnidadeFieldErrors] = useState<Record<number, string>>({});

  const [previsaoRetirada, setPrevisaoRetirada] = useState("");
  const [bookingDeadline, setBookingDeadline] = useState("");
  const [layerReady, setLayerReady] = useState(false);

  const pessoa = usePessoaAutorizadaStore((s) => s.pessoa);
  const user = usePortalClienteAuthStore((s) => s.user);

  const isFrotaFL = useMemo(() => intentUsesFlFrete(intent), [intent]);
  const { hint: motoristaHint, bloqueio: motoristaBloqueio } = useMotoristaCpfAutofill({
    cpf: isFrotaFL ? "" : cpfMotorista,
    nome: nomeMotorista,
    setNome: setNomeMotorista,
    source: "portal",
  });
  const usesEstoqueDoCliente = useMemo(() => intentUsesEstoqueDoCliente(intent), [intent]);
  const showPrevisaoRetirada = useMemo(() => intentUsesPrevisaoRetirada(intent), [intent]);
  const showBookingDeadline = useMemo(() => intentUsesBookingDeadline(intent), [intent]);
  const containerCount = isFrotaFL || tipoCaminhao === "LS" ? 1 : 2;
  const { tipos: tiposContainer, loading: loadingTipos } = usePortalTiposContainer(open);
  const estoque = usePortalEstoqueCliente(open && usesEstoqueDoCliente);
  const prefillAppliedIso = useRef<string | null>(null);
  const [prefillStockItem, setPrefillStockItem] = useState<PortalPatioSaldoItem | null>(null);

  const estoqueItems = useMemo(() => {
    if (!prefillStockItem) return estoque.items;
    const iso = stripContainerISO(prefillStockItem.unidadeIso);
    if (estoque.items.some((row) => stripContainerISO(row.unidadeIso) === iso)) {
      return estoque.items;
    }
    return [prefillStockItem, ...estoque.items];
  }, [prefillStockItem, estoque.items]);

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
    if (!open) {
      setLayerReady(false);
      return;
    }
    const t = window.setTimeout(() => setLayerReady(true), 250);
    return () => window.clearTimeout(t);
  }, [open]);

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

  useEffect(() => {
    if (!open) {
      prefillAppliedIso.current = null;
      setPrefillStockItem(null);
      return;
    }
    if (!usesEstoqueDoCliente || !prefillIso) return;
    const iso = stripContainerISO(prefillIso);
    if (!iso || prefillAppliedIso.current === iso) return;

    const fromPatio = peekPortalSaidaPrefill(iso);
    const item =
      fromPatio ??
      (estoque.ready
        ? estoqueItems.find((row) => stripContainerISO(row.unidadeIso) === iso)
        : undefined);

    if (!item) {
      if (estoque.ready && !estoque.error) {
        toast.error("Esta unidade não está em estoque disponível para saída.");
        prefillAppliedIso.current = iso;
      }
      return;
    }

    prefillAppliedIso.current = iso;
    clearPortalSaidaPrefill();
    setPrefillStockItem(item);
    const tipo = item.tipo?.trim().toUpperCase() ?? "";
    setContainers((prev) => {
      const first = prev[0] ?? emptyContainer(1);
      return [
        {
          ...first,
          ordem: 1,
          unidade: formatContainerISO(item.unidadeIso),
          tipo,
          tamanho: item.tamanho ? normalizeTamanhoContainer(item.tamanho) : "",
          status: item.statusContainer === "VAZIO" ? "VAZIO" : "CHEIO",
          booking: item.booking ?? "",
          processo: item.processo ?? "",
          navio: item.navio ?? "",
          refrigerado: item.refrigerado,
        },
        ...prev.slice(1),
      ];
    });
  }, [open, usesEstoqueDoCliente, prefillIso, estoque.ready, estoqueItems, estoque.error]);

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
    setFiles([]);
    setPrevisaoRetirada("");
    setBookingDeadline("");
    setUnidadeFieldErrors({});
    setCatalogoHints({});
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function updateContainer(i: number, patch: Partial<ContainerDraft>) {
    if (patch.unidade !== undefined) {
      setUnidadeFieldErrors((prev) => {
        const next = { ...prev };
        delete next[i];
        return next;
      });
    }
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

  async function applyCatalogo(i: number, iso: string) {
    try {
      const hit = await fetchPortalCatalogoContainer(iso);
      if (!hit) {
        setCatalogoHints((prev) => ({ ...prev, [i]: "" }));
        return;
      }
      setCatalogoHints((prev) => ({ ...prev, [i]: catalogoContainerHint(hit) }));
      setContainers((rows) => {
        const atual = rows[i];
        if (!atual) return rows;
        const patch = patchFromCatalogo(atual, hit, tiposContainer.map((t) => t.codigo));
        if (!Object.keys(patch).length) return rows;
        const next = [...rows];
        next[i] = { ...atual, ...patch };
        return next;
      });
    } catch {
      /* catálogo é só atalho */
    }
  }

  function applyEstoque(idx: number, item: PortalPatioSaldoItem | null) {
    if (!item) {
      updateContainer(idx, { unidade: "" });
      return;
    }
    const tipo = item.tipo?.trim().toUpperCase() ?? "";
    updateContainer(idx, {
      unidade: formatContainerISO(item.unidadeIso),
      tipo,
      tamanho: item.tamanho ? normalizeTamanhoContainer(item.tamanho) : "",
      status: item.statusContainer === "VAZIO" ? "VAZIO" : "CHEIO",
      booking: item.booking ?? "",
      processo: item.processo ?? "",
      navio: item.navio ?? "",
      refrigerado: item.refrigerado,
    });
    void applyCatalogo(idx, stripContainerISO(item.unidadeIso));
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
          navio: c.navio.trim(),
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
        turno: resolveAgendamentoTurno(turnos, turno),
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
      if (motoristaBloqueio) {
        toast.error(motoristaBloqueio);
        return;
      }
    }

    const ordens = containers.slice(0, containerCount);
    if (usesEstoqueDoCliente) {
      const allowed = new Set(estoqueItems.map((i) => stripContainerISO(i.unidadeIso)));
      const seen = new Set<string>();
      for (const c of ordens) {
        const iso = stripContainerISO(c.unidade);
        if (!iso || !allowed.has(iso)) {
          toast.error(
            `Contêiner #${c.ordem}: selecione uma unidade do estoque deste cliente (lupa).`,
          );
          return;
        }
        if (seen.has(iso)) {
          toast.error("Não use a mesma unidade nos dois contêineres.");
          return;
        }
        seen.add(iso);
      }
    }
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
      const msg = err instanceof ApiError ? err.message : "Falha ao salvar";
      toast.error(msg);
      const parsed = parseUnidadeEstoqueError(msg);
      const next: Record<number, string> = {};
      containers.slice(0, containerCount).forEach((c, i) => {
        const field = fieldErrorForContainer(c.unidade, parsed, msg);
        if (field) next[i] = field;
      });
      setUnidadeFieldErrors(next);
    } finally {
      setSaving(false);
    }
  }

  const selectCls = SELECT_CLS;

  if (!open || !intent) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] overflow-y-auto bg-black/70 backdrop-blur-sm ${layerReady ? "" : "pointer-events-none"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="solicitacao-form-title"
    >
      <div className="flex min-h-full items-start justify-center p-4 py-8">
        <div className="relative w-[min(1440px,95vw)] rounded-2xl border border-white/10 bg-[#0f1419] p-3 shadow-2xl">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-md text-slate-400 opacity-70 hover:opacity-100"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mb-2 pr-8">
            <h2 id="solicitacao-form-title" className="text-lg font-semibold text-white">
              {label}
            </h2>
            <p className="text-sm text-slate-400">
              {isFrotaFL
                ? "Transporte Frota FL — 1 contêiner. Informe endereço e dados da unidade."
                : "Frota do cliente — escolha LS ou Rodotrem e informe o motorista."}
            </p>
          </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          {intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT" ? (
            <Card className="border-white/10 bg-black/25">
              <CardHeader className={CARD_H}>
                <CardTitle className="text-sm text-white">Local de origem</CardTitle>
              </CardHeader>
              <CardContent className={CARD_C}>
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
              <CardHeader className={CARD_H}>
                <CardTitle className="text-sm text-white">Local de destino</CardTitle>
              </CardHeader>
              <CardContent className={CARD_C}>
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

          {showPrevisaoRetirada || showBookingDeadline ? (
            <Card className="border-white/10 bg-black/25">
              <CardHeader className={CARD_H}>
                <CardTitle className="text-sm text-white">Prazos (opcional)</CardTitle>
              </CardHeader>
              <CardContent className={`${GRID} ${CARD_C}`}>
                {showPrevisaoRetirada ? (
                  <div className={SPAN2}>
                    <label className="mb-1 block text-xs text-slate-500">Previsão de retirada</label>
                    <Input
                      type="datetime-local"
                      value={previsaoRetirada}
                      onChange={(e) => setPrevisaoRetirada(e.target.value)}
                      className="bg-black/40"
                    />
                  </div>
                ) : null}
                {showBookingDeadline ? (
                  <div className={SPAN2}>
                    <label className="mb-1 block text-xs text-slate-500">Deadline do navio / booking</label>
                    <Input
                      type="datetime-local"
                      value={bookingDeadline}
                      onChange={(e) => setBookingDeadline(e.target.value)}
                      className="bg-black/40"
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-white/10 bg-black/25">
            <CardHeader className={CARD_H}>
              <CardTitle className="text-sm text-white">Transporte</CardTitle>
            </CardHeader>
            <CardContent className={`${GRID} ${CARD_C}`}>
              {!isFrotaFL ? (
                <>
                  <div className={SPAN2}>
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
                    {motoristaBloqueio ? (
                      <p className="mt-1 text-[11px] text-red-400">{motoristaBloqueio}</p>
                    ) : motoristaHint ? (
                      <p className="mt-1 text-[11px] text-slate-400">{motoristaHint}</p>
                    ) : null}
                  </div>
                </>
              ) : null}
              <div>
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
              <CardHeader className={CARD_H}>
                <CardTitle className="text-sm text-white">Contêiner #{c.ordem}</CardTitle>
              </CardHeader>
              <CardContent className={`${GRID} ${CARD_C}`}>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    {usesEstoqueDoCliente ? "Unidade em estoque (deste cliente)" : "Unidade / ISO"}
                  </label>
                  {usesEstoqueDoCliente ? (
                    <ContainerEstoqueSearch
                      value={c.unidade}
                      onSelect={(item) => applyEstoque(idx, item)}
                      items={estoqueItems}
                      loading={estoque.loading && !prefillStockItem}
                      error={estoque.error}
                      excludeIsos={containers
                        .slice(0, containerCount)
                        .filter((_, i) => i !== idx)
                        .map((row) => row.unidade)}
                      required
                      className="bg-black/40"
                    />
                  ) : (
                    <ContainerIsoInput
                      value={c.unidade}
                      onChange={(v) => updateContainer(idx, { unidade: v })}
                      onIsoComplete={(iso) => void applyCatalogo(idx, iso)}
                      required
                      className="bg-black/40 font-mono"
                    />
                  )}
                  {unidadeFieldErrors[idx] ? (
                    <p className="mt-1 text-xs text-red-400">{unidadeFieldErrors[idx]}</p>
                  ) : catalogoHints[idx] ? (
                    <p className="mt-1 text-[11px] text-slate-400">{catalogoHints[idx]}</p>
                  ) : null}
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
                  <label className="mb-1 block text-xs text-slate-500">Navio (opcional)</label>
                  <Input
                    value={c.navio}
                    onChange={(e) => updateContainer(idx, { navio: e.target.value })}
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
                  <div>
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
                        Tomada reefer
                      </label>
                      <ContainerRefrigeradoSelect
                        value={c.refrigerado}
                        onChange={(v) => updateContainer(idx, { refrigerado: v })}
                        selectClassName={selectCls}
                      />
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
            <CardHeader className={CARD_H}>
              <CardTitle className="text-sm text-white">Agendamento e contato</CardTitle>
              {pessoa && user?.cpfCnpj ? (
                <CardDescription>
                  Responsável: {pessoa.nome} (CNPJ/CPF {formatCpfCnpjBr(user.cpfCnpj)})
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className={`${GRID} ${CARD_C}`}>
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
              <div className={SPAN2}>
                <label className="mb-1 block text-xs text-slate-500">Nome</label>
                <Input
                  value={solNome}
                  onChange={(e) => setSolNome(e.target.value)}
                  required
                  className="bg-black/40"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/25">
            <CardHeader className={CARD_H}>
              <CardTitle className="text-sm text-white">Anexos (opcional)</CardTitle>
              <CardDescription>JPG ou PDF, até 5MB. Pode anexar depois.</CardDescription>
            </CardHeader>
            <CardContent className={`${CARD_C} space-y-2`}>
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

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar solicitação"}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
