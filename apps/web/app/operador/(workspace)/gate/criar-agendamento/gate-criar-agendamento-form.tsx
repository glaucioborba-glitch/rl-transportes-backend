"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, staffCriarSolicitacaoV2 } from "@/lib/api/staff-client";
import { listAlugueisClientes } from "@/lib/api/alugueis-client";
import { fetchCatalogosConferencia, fetchStaffCatalogoContainer, type CatalogoTipoContainer } from "@/lib/gate/operacao-api";
import { catalogoContainerHint, patchFromCatalogo } from "@/lib/catalogo-container-iso";
import type { TipoOperacaoSolicitacaoIntent } from "@/lib/api/portal-client";
import { useTenantTurnos } from "@/hooks/use-tenant-turnos";
import { resolveAgendamentoTurno } from "@/lib/api/tenant-config-client";
import {
  intentUsesBookingDeadline,
  intentUsesFlFrete,
  intentUsesPrevisaoRetirada,
  optionalDateTimeLocalToIso,
} from "@/lib/solicitacao-intent";
import {
  ContainerIsoInput,
  ContainerTamanhoSelect,
  ContainerTipoSelect,
  findPortalTipo,
} from "@/components/portal/container-form-fields";
import { formatTamanhoContainerDisplay, normalizeTamanhoContainer } from "@/lib/cadastros/tipo-container-tamanhos";
import { stripContainerISO } from "@/utils/containerFormatter";
import { toast } from "@/lib/toast";
import {
  SOLICITACAO_CARD_C as CARD_C,
  SOLICITACAO_CARD_H as CARD_H,
  SOLICITACAO_FORM_GRID as GRID,
  SOLICITACAO_SELECT_CLS as SELECT,
  SOLICITACAO_SPAN2 as SPAN2,
  SOLICITACAO_SPAN4 as SPAN4,
} from "@/components/portal/solicitacao-form-layout";
import { useMotoristaCpfAutofill } from "@/hooks/use-motorista-cpf-autofill";

type TipoCaminhao = "LS" | "RODOTREM" | "";
type Situacao = "CHEIO" | "VAZIO" | "";

type ContainerDraft = {
  unidade: string;
  booking: string;
  processo: string;
  navio: string;
  tamanho: string;
  tipo: string;
  status: Situacao;
  lacre: string;
  refrigerado: boolean | null;
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
    status: "",
    lacre: "",
    refrigerado: null,
    setPoint: "",
    ordem,
  };
}

const LABEL = "mb-1 block text-xs text-slate-500";

type ClienteOpt = { id: string; razaoSocial: string; nomeFantasia: string | null };

export function GateCriarAgendamentoForm({
  intent,
  onCancel,
}: {
  intent: TipoOperacaoSolicitacaoIntent;
  onCancel: () => void;
}) {
  const router = useRouter();
  const isFrotaFL = intentUsesFlFrete(intent);
  const showPrevisao = intentUsesPrevisaoRetirada(intent);
  const showDeadline = intentUsesBookingDeadline(intent);

  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [tipos, setTipos] = useState<CatalogoTipoContainer[]>([]);

  const [tipoCaminhao, setTipoCaminhao] = useState<TipoCaminhao>("");
  const [nomeMotorista, setNomeMotorista] = useState("");
  const [cpfMotorista, setCpfMotorista] = useState("");
  const { hint: motoristaHint, bloqueio: motoristaBloqueio } = useMotoristaCpfAutofill({
    cpf: isFrotaFL ? "" : cpfMotorista,
    nome: nomeMotorista,
    setNome: setNomeMotorista,
    source: "staff",
  });
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta01, setPlacaCarreta01] = useState("");
  const [placaCarreta02, setPlacaCarreta02] = useState("");

  const [localOrigem, setLocalOrigem] = useState("");
  const [localDestino, setLocalDestino] = useState("");
  const [previsaoRetirada, setPrevisaoRetirada] = useState("");
  const [bookingDeadline, setBookingDeadline] = useState("");

  const [containers, setContainers] = useState<ContainerDraft[]>([emptyContainer(1)]);
  const [catalogoHints, setCatalogoHints] = useState<Record<number, string>>({});
  const [dataRef, setDataRef] = useState("");
  const { turnos } = useTenantTurnos();
  const [turno, setTurno] = useState("");

  const [solNome, setSolNome] = useState("");
  const [solTelefone, setSolTelefone] = useState("");
  const [solEmail, setSolEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const containerCount = isFrotaFL || tipoCaminhao !== "RODOTREM" ? 1 : 2;

  useEffect(() => {
    void listAlugueisClientes()
      .then((r) => setClientes(r.items ?? []))
      .catch(() => setClientes([]));
    void fetchCatalogosConferencia()
      .then((r) => setTipos(r.tiposContainer ?? []))
      .catch(() => setTipos([]));
  }, []);

  useEffect(() => {
    setContainers((rows) => {
      const next = Array.from({ length: containerCount }, (_, i) => rows[i] ?? emptyContainer(i + 1));
      return next.map((c, i) => ({ ...c, ordem: i + 1 }));
    });
  }, [containerCount]);

  const clientesFiltrados = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      [c.razaoSocial, c.nomeFantasia ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [clientes, buscaCliente]);

  async function applyCatalogo(i: number, iso: string) {
    try {
      const hit = await fetchStaffCatalogoContainer(iso);
      if (!hit) {
        setCatalogoHints((prev) => ({ ...prev, [i]: "" }));
        return;
      }
      setCatalogoHints((prev) => ({ ...prev, [i]: catalogoContainerHint(hit) }));
      setContainers((rows) => {
        const atual = rows[i];
        if (!atual) return rows;
        const patch = patchFromCatalogo(atual, hit, tipos.map((t) => t.codigo));
        if (!Object.keys(patch).length) return rows;
        const next = [...rows];
        next[i] = { ...atual, ...patch };
        return next;
      });
    } catch {
      /* catálogo é só atalho */
    }
  }

  function updateContainer(i: number, patch: Partial<ContainerDraft>) {
    setContainers((rows) => {
      const next = [...rows];
      const merged = { ...next[i], ...patch };
      if (patch.tipo !== undefined) {
        const tipo = findPortalTipo(tipos, patch.tipo);
        const tamanhoOk = tipo?.tamanhos.some(
          (t) => normalizeTamanhoContainer(t) === normalizeTamanhoContainer(merged.tamanho),
        );
        if (!tamanhoOk) merged.tamanho = "";
        if (!tipo?.tomadaReefer) {
          merged.refrigerado = null;
          merged.setPoint = "";
        }
      }
      if (patch.status === "VAZIO") merged.lacre = "";
      if (merged.refrigerado !== true) merged.setPoint = "";
      next[i] = merged;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) {
      toast.error("Selecione o cliente.");
      return;
    }
    if (intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT" && !localOrigem.trim()) {
      toast.error("Informe o local de origem.");
      return;
    }
    if (intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT" && !localDestino.trim()) {
      toast.error("Informe o local de destino.");
      return;
    }
    if (!isFrotaFL) {
      if (!tipoCaminhao) {
        toast.error("Selecione o tipo de caminhão.");
        return;
      }
      if (!nomeMotorista.trim() || cpfMotorista.replace(/\D/g, "").length !== 11) {
        toast.error("Informe nome e CPF válido do motorista.");
        return;
      }
      if (motoristaBloqueio) {
        toast.error(motoristaBloqueio);
        return;
      }
    }
    if (!dataRef || !turno) {
      toast.error("Informe data e turno do agendamento.");
      return;
    }
    if (!solNome.trim() || !solTelefone.trim() || !solEmail.trim()) {
      toast.error("Informe nome, telefone e e-mail do solicitante.");
      return;
    }

    const ordens = containers.slice(0, containerCount);
    for (const c of ordens) {
      if (!c.unidade.trim() || !c.tipo || !c.tamanho || !c.status) {
        toast.error(`Preencha unidade, tipo, tamanho e situação do contêiner #${c.ordem}.`);
        return;
      }
      if (c.refrigerado === true) {
        const n = Number(c.setPoint.replace(",", "."));
        if (c.setPoint.trim() === "" || Number.isNaN(n) || n < -30 || n > 30) {
          toast.error(`Set point entre -30 e 30 °C no contêiner #${c.ordem}.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const created = await staffCriarSolicitacaoV2({
        clienteId,
        tipoOperacao: intent,
        ...(intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT" ? { localOrigem: localOrigem.trim() } : {}),
        ...(intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT" ? { localDestino: localDestino.trim() } : {}),
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
        containers: ordens.map((c) => ({
          unidade: stripContainerISO(c.unidade),
          booking: c.booking.trim(),
          processo: c.processo.trim(),
          navio: c.navio.trim(),
          tamanho: formatTamanhoContainerDisplay(c.tamanho),
          tipo: c.tipo.trim().toUpperCase(),
          status: c.status,
          lacre: c.status === "CHEIO" ? c.lacre.trim() : undefined,
          refrigerado: c.refrigerado === true,
          setPoint:
            c.refrigerado === true && c.setPoint.trim()
              ? Number(c.setPoint.replace(",", "."))
              : undefined,
          ordem: c.ordem,
        })),
        agendamento: {
          dataRef,
          turno: resolveAgendamentoTurno(turnos, turno),
        },
        solicitante: {
          nome: solNome.trim(),
          telefone: solTelefone.trim(),
          email: solEmail.trim().toLowerCase(),
        },
        ...(showPrevisao ? { previsaoRetirada: optionalDateTimeLocalToIso(previsaoRetirada) } : {}),
        ...(showDeadline ? { bookingDeadline: optionalDateTimeLocalToIso(bookingDeadline) } : {}),
      });
      toast.success(created.protocolo ? `Agendamento ${created.protocolo} criado.` : "Agendamento criado.");
      router.push("/operador/gate/autorizacoes");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao criar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <Card className="border-white/10 bg-black/25">
        <CardHeader className={CARD_H}>
          <CardTitle className="text-sm text-white">Cliente</CardTitle>
        </CardHeader>
        <CardContent className={`${GRID} ${CARD_C}`}>
          <div>
            <label className={LABEL}>Filtrar</label>
            <Input
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              placeholder="Nome ou fantasia"
              className="bg-black/40"
            />
          </div>
          <div className={`${SPAN2} lg:col-span-3`}>
            <label className={LABEL}>Cliente</label>
            <select
              className={SELECT}
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              required
            >
              <option value="">Selecione…</option>
              {clientesFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia || c.razaoSocial}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT" ? (
        <Card className="border-white/10 bg-black/25">
          <CardHeader className={CARD_H}>
            <CardTitle className="text-sm text-white">Local de origem</CardTitle>
          </CardHeader>
          <CardContent className={`${GRID} ${CARD_C}`}>
            <div className={SPAN4}>
              <label className={LABEL}>Endereço ou referência</label>
              <Input
                value={localOrigem}
                onChange={(e) => setLocalOrigem(e.target.value)}
                required
                className="bg-black/40"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT" ? (
        <Card className="border-white/10 bg-black/25">
          <CardHeader className={CARD_H}>
            <CardTitle className="text-sm text-white">Local de destino</CardTitle>
          </CardHeader>
          <CardContent className={`${GRID} ${CARD_C}`}>
            <div className={SPAN4}>
              <label className={LABEL}>Endereço ou referência</label>
              <Input
                value={localDestino}
                onChange={(e) => setLocalDestino(e.target.value)}
                required
                className="bg-black/40"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showPrevisao || showDeadline ? (
        <Card className="border-white/10 bg-black/25">
          <CardHeader className={CARD_H}>
            <CardTitle className="text-sm text-white">Prazos (opcional)</CardTitle>
          </CardHeader>
          <CardContent className={`${GRID} ${CARD_C}`}>
            {showPrevisao ? (
              <div className={SPAN2}>
                <label className={LABEL}>Previsão de retirada</label>
                <Input
                  type="datetime-local"
                  value={previsaoRetirada}
                  onChange={(e) => setPrevisaoRetirada(e.target.value)}
                  className="bg-black/40"
                />
              </div>
            ) : null}
            {showDeadline ? (
              <div className={SPAN2}>
                <label className={LABEL}>Deadline do navio / booking</label>
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

      {!isFrotaFL ? (
        <Card className="border-white/10 bg-black/25">
          <CardHeader className={CARD_H}>
            <CardTitle className="text-sm text-white">Transporte do cliente</CardTitle>
          </CardHeader>
          <CardContent className={`${GRID} ${CARD_C}`}>
            <div>
              <label className={LABEL}>Tipo de caminhão</label>
              <select
                className={SELECT}
                value={tipoCaminhao}
                onChange={(e) => setTipoCaminhao(e.target.value as TipoCaminhao)}
                required
              >
                <option value="">Selecione…</option>
                <option value="LS">LS (1 contêiner)</option>
                <option value="RODOTREM">Rodotrem (2 contêineres)</option>
              </select>
            </div>
            <div className={SPAN2}>
              <label className={LABEL}>Nome do motorista</label>
              <Input
                value={nomeMotorista}
                onChange={(e) => setNomeMotorista(e.target.value)}
                className="bg-black/40"
              />
            </div>
            <div>
              <label className={LABEL}>CPF do motorista</label>
              <Input
                value={cpfMotorista}
                onChange={(e) => setCpfMotorista(e.target.value)}
                className="bg-black/40"
              />
              {motoristaBloqueio ? (
                <p className="mt-1 text-[11px] text-red-400">{motoristaBloqueio}</p>
              ) : motoristaHint ? (
                <p className="mt-1 text-[11px] text-slate-400">{motoristaHint}</p>
              ) : null}
            </div>
            <div>
              <label className={LABEL}>Placa cavalo</label>
              <Input
                value={placaCavalo}
                onChange={(e) => setPlacaCavalo(e.target.value.toUpperCase())}
                className="bg-black/40"
              />
            </div>
            <div>
              <label className={LABEL}>Placa carreta 01</label>
              <Input
                value={placaCarreta01}
                onChange={(e) => setPlacaCarreta01(e.target.value.toUpperCase())}
                className="bg-black/40"
              />
            </div>
            {tipoCaminhao === "RODOTREM" ? (
              <div>
                <label className={LABEL}>Placa carreta 02</label>
                <Input
                  value={placaCarreta02}
                  onChange={(e) => setPlacaCarreta02(e.target.value.toUpperCase())}
                  className="bg-black/40"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-zinc-400">Transporte Frota FL — 1 contêiner. Informe os dados da unidade.</p>
      )}

      {containers.slice(0, containerCount).map((c, i) => {
        const tipo = findPortalTipo(tipos, c.tipo);
        return (
          <Card key={c.ordem} className="border-white/10 bg-black/25">
            <CardHeader className={CARD_H}>
              <CardTitle className="text-sm text-white">Contêiner #{c.ordem}</CardTitle>
            </CardHeader>
            <CardContent className={`${GRID} ${CARD_C}`}>
              <div>
                <label className={LABEL}>Unidade / ISO</label>
                <ContainerIsoInput
                  value={c.unidade}
                  onChange={(v) => updateContainer(i, { unidade: v })}
                  onIsoComplete={(iso) => void applyCatalogo(i, iso)}
                  required
                  className="bg-black/40"
                />
                {catalogoHints[i] ? (
                  <p className="mt-1 text-[11px] text-slate-400">{catalogoHints[i]}</p>
                ) : null}
              </div>
              <div>
                <label className={LABEL}>Tipo</label>
                <ContainerTipoSelect
                  value={c.tipo}
                  onChange={(v) => updateContainer(i, { tipo: v })}
                  required
                  selectClassName={SELECT}
                  tipos={tipos}
                />
              </div>
              <div>
                <label className={LABEL}>Tamanho</label>
                <ContainerTamanhoSelect
                  value={c.tamanho}
                  onChange={(v) => updateContainer(i, { tamanho: v })}
                  required
                  selectClassName={SELECT}
                  tamanhos={tipo?.tamanhos ?? []}
                />
              </div>
              <div>
                <label className={LABEL}>Situação</label>
                <select
                  className={SELECT}
                  value={c.status}
                  onChange={(e) => updateContainer(i, { status: e.target.value as Situacao })}
                  required
                >
                  <option value="">Selecione…</option>
                  <option value="CHEIO">Cheio</option>
                  <option value="VAZIO">Vazio</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Booking (opcional)</label>
                <Input
                  value={c.booking}
                  onChange={(e) => updateContainer(i, { booking: e.target.value })}
                  className="bg-black/40"
                />
              </div>
              <div>
                <label className={LABEL}>Processo (opcional)</label>
                <Input
                  value={c.processo}
                  onChange={(e) => updateContainer(i, { processo: e.target.value })}
                  className="bg-black/40"
                />
              </div>
              <div>
                <label className={LABEL}>Navio (opcional)</label>
                <Input
                  value={c.navio}
                  onChange={(e) => updateContainer(i, { navio: e.target.value })}
                  className="bg-black/40"
                />
              </div>
              {c.status === "CHEIO" ? (
                <div>
                  <label className={LABEL}>Lacre</label>
                  <Input
                    value={c.lacre}
                    onChange={(e) => updateContainer(i, { lacre: e.target.value })}
                    className="bg-black/40"
                  />
                </div>
              ) : null}
              {tipo?.tomadaReefer ? (
              <div>
                <label className={LABEL}>Tomada</label>
                <select
                  className={SELECT}
                  value={c.refrigerado === true ? "sim" : c.refrigerado === false ? "nao" : ""}
                  onChange={(e) =>
                    updateContainer(i, {
                      refrigerado: e.target.value === "" ? null : e.target.value === "sim",
                    })
                  }
                >
                  <option value="">Selecione…</option>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              ) : null}
              {tipo?.tomadaReefer && c.refrigerado === true ? (
                <div>
                  <label className={LABEL}>Set point (°C)</label>
                  <Input
                    value={c.setPoint}
                    onChange={(e) => updateContainer(i, { setPoint: e.target.value })}
                    className="bg-black/40"
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-white/10 bg-black/25">
        <CardHeader className={CARD_H}>
          <CardTitle className="text-sm text-white">Agendamento e solicitante</CardTitle>
        </CardHeader>
        <CardContent className={`${GRID} ${CARD_C}`}>
          <div>
            <label className={LABEL}>Data</label>
            <Input
              type="date"
              value={dataRef}
              onChange={(e) => setDataRef(e.target.value)}
              required
              className="bg-black/40"
            />
          </div>
          <div>
            <label className={LABEL}>Turno</label>
            <select className={SELECT} value={turno} onChange={(e) => setTurno(e.target.value)} required>
              <option value="">Selecione…</option>
              {turnos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Telefone</label>
            <Input
              value={solTelefone}
              onChange={(e) => setSolTelefone(e.target.value)}
              required
              className="bg-black/40"
            />
          </div>
          <div>
            <label className={LABEL}>E-mail</label>
            <Input
              value={solEmail}
              onChange={(e) => setSolEmail(e.target.value)}
              placeholder=""
              type="email"
              required
              className="bg-black/40"
            />
          </div>
          <div className={SPAN2}>
            <label className={LABEL}>Nome do solicitante</label>
            <Input
              value={solNome}
              onChange={(e) => setSolNome(e.target.value)}
              required
              className="bg-black/40"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Criar agendamento"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
