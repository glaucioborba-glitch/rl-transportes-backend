"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, staffCriarSolicitacaoV2 } from "@/lib/api/staff-client";
import { fetchCatalogosConferencia, fetchStaffCatalogoContainer, type CatalogoTipoContainer } from "@/lib/gate/operacao-api";
import { catalogoContainerHint, patchFromCatalogo } from "@/lib/catalogo-container-iso";
import { NavioAutocompleteInput } from "@/components/catalogo/navio-autocomplete-input";
import type { TipoOperacaoSolicitacaoIntent } from "@/lib/api/portal-client";
import { useTenantTurnos } from "@/hooks/use-tenant-turnos";
import { turnoOperacionalAgora } from "@/lib/api/tenant-config-client";
import { todayDateInputValue } from "@/lib/solicitacao-intent";
import {
  ContainerIsoInput,
  ContainerTamanhoSelect,
  ContainerTipoSelect,
  findPortalTipo,
} from "@/components/portal/container-form-fields";
import { formatTamanhoContainerDisplay, normalizeTamanhoContainer } from "@/lib/cadastros/tipo-container-tamanhos";
import { isValidISO6346 } from "@/lib/cadastros/formatters";
import { stripContainerISO } from "@/utils/containerFormatter";
import { toast } from "@/lib/toast";
import {
  SOLICITACAO_CARD_C as CARD_C,
  SOLICITACAO_CARD_H as CARD_H,
  SOLICITACAO_FORM_GRID as GRID,
  SOLICITACAO_SELECT_CLS as SELECT,
  SOLICITACAO_SPAN2 as SPAN2,
} from "@/components/portal/solicitacao-form-layout";
import { useMotoristaCpfAutofill } from "@/hooks/use-motorista-cpf-autofill";

type TipoCaminhao = "LS" | "RODOTREM" | "";
type Situacao = "CHEIO" | "VAZIO" | "";
type PagamentoAvista = "PIX" | "DINHEIRO";

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

function horaAgora(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const LABEL = "mb-1 block text-xs text-slate-500";

export function GateAgendamentoRapidoParticularForm({
  intent,
  onCancel,
}: {
  intent: TipoOperacaoSolicitacaoIntent;
  onCancel: () => void;
}) {
  const router = useRouter();
  const { turnos } = useTenantTurnos();

  const [tipos, setTipos] = useState<CatalogoTipoContainer[]>([]);

  const [tipoCaminhao, setTipoCaminhao] = useState<TipoCaminhao>("");
  const [nomeMotorista, setNomeMotorista] = useState("");
  const [cpfMotorista, setCpfMotorista] = useState("");
  const { hint: motoristaHint, bloqueio: motoristaBloqueio } = useMotoristaCpfAutofill({
    cpf: cpfMotorista,
    nome: nomeMotorista,
    setNome: setNomeMotorista,
    source: "staff",
  });
  const [telefoneMotorista, setTelefoneMotorista] = useState("");
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta01, setPlacaCarreta01] = useState("");
  const [placaCarreta02, setPlacaCarreta02] = useState("");
  const [autorizadas, setAutorizadas] = useState<
    Array<{ nome: string; cpf: string; placaCavalo: string; placaCarreta: string }>
  >([{ nome: "", cpf: "", placaCavalo: "", placaCarreta: "" }]);

  const [containers, setContainers] = useState<ContainerDraft[]>([emptyContainer(1)]);
  const [catalogoHints, setCatalogoHints] = useState<Record<number, string>>({});

  const [pagamento, setPagamento] = useState<PagamentoAvista>("PIX");
  const [solNome, setSolNome] = useState("");
  const [solTelefone, setSolTelefone] = useState("");
  const [solEmail, setSolEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const containerCount = tipoCaminhao !== "RODOTREM" ? 1 : 2;
  const instante = useMemo(() => {
    const agora = new Date();
    return {
      dataRef: todayDateInputValue(),
      hora: horaAgora(agora),
      turno: turnoOperacionalAgora(turnos, agora),
    };
  }, [turnos]);

  useEffect(() => {
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
    if (!tipoCaminhao) {
      toast.error("Selecione o tipo de caminhão.");
      return;
    }
    if (!nomeMotorista.trim() || cpfMotorista.replace(/\D/g, "").length !== 11) {
      toast.error("Informe nome e CPF válido do motorista.");
      return;
    }
    if (telefoneMotorista.replace(/\D/g, "").length < 10) {
      toast.error("Informe o telefone do motorista (com DDD).");
      return;
    }
    if (motoristaBloqueio) {
      toast.error(motoristaBloqueio);
      return;
    }
    const autorizadasOk: Array<{ nome: string; cpf: string }> = [];
    for (const p of autorizadas) {
      const nome = p.nome.trim();
      const cpf = p.cpf.replace(/\D/g, "");
      if (!nome && !cpf) continue;
      if (!nome || cpf.length !== 11) {
        toast.error("Pessoas autorizadas: preencha nome e CPF válido, ou deixe a linha em branco.");
        return;
      }
      autorizadasOk.push({ nome, cpf });
    }
    if (!solNome.trim() || !solTelefone.trim() || !solEmail.trim()) {
      toast.error("Informe nome, telefone e e-mail de quem solicita.");
      return;
    }

    const agora = new Date();
    const dataRef = todayDateInputValue();
    const hora = horaAgora(agora);
    const turno = turnoOperacionalAgora(turnos, agora);

    const ordens = containers.slice(0, containerCount);
    for (const c of ordens) {
      if (!c.unidade.trim() || !c.tipo || !c.tamanho || !c.status) {
        toast.error(`Preencha unidade, tipo, tamanho e situação do contêiner #${c.ordem}.`);
        return;
      }
      if (!isValidISO6346(stripContainerISO(c.unidade))) {
        toast.error(`Número ISO inválido (dígito verificador) no contêiner #${c.ordem}.`);
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
        tipoOperacao: intent,
        pagamentoAvista: pagamento,
        telefoneMotorista: telefoneMotorista.replace(/\D/g, ""),
        ...(autorizadasOk.length ? { pessoasAutorizadasRetirada: autorizadasOk } : {}),
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
          turno,
          horaInicio: hora,
        },
        solicitante: {
          nome: solNome.trim(),
          telefone: solTelefone.trim(),
          email: solEmail.trim().toLowerCase(),
        },
      });
      toast.success(
        created.protocolo
          ? `Operação ${created.protocolo} registrada (${pagamento === "PIX" ? "PIX" : "dinheiro"}).`
          : "Operação registrada.",
      );
      router.push("/operador/gate/autorizacoes");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao registrar a operação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400">
        Registrado neste instante:{" "}
        <span className="text-zinc-200">
          {instante.dataRef} · {instante.hora} · {instante.turno === "MANHA" ? "manhã" : "tarde"}
        </span>
      </p>

      <Card className="border-white/10 bg-black/25">
        <CardHeader className={CARD_H}>
          <CardTitle className="text-sm text-white">Transporte</CardTitle>
        </CardHeader>
        <CardContent className={`${GRID} ${CARD_C}`}>
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
          <div className={SPAN2}>
            <label className={LABEL}>Nome do motorista</label>
            <Input
              value={nomeMotorista}
              onChange={(e) => setNomeMotorista(e.target.value)}
              className="bg-black/40"
            />
          </div>
          <div>
            <label className={LABEL}>Telefone</label>
            <Input
              value={telefoneMotorista}
              onChange={(e) => setTelefoneMotorista(e.target.value)}
              placeholder="(47) 99999-0000"
              inputMode="tel"
              required
              className="bg-black/40"
            />
          </div>
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
                <NavioAutocompleteInput
                  source="staff"
                  value={c.navio}
                  onChange={(v) => updateContainer(i, { navio: v })}
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
          <CardTitle className="text-sm text-white">Pagamento à vista e contato</CardTitle>
        </CardHeader>
        <CardContent className={`${GRID} ${CARD_C}`}>
          <div className={SPAN2}>
            <label className={LABEL}>Forma</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "PIX", label: "PIX" },
                  { id: "DINHEIRO", label: "Dinheiro" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPagamento(opt.id)}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    pagamento === opt.id
                      ? "border-sky-400/60 bg-sky-500/15 text-white"
                      : "border-white/10 bg-black/40 text-zinc-300 hover:border-white/25"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
              type="email"
              required
              className="bg-black/40"
            />
          </div>
          <div className={SPAN2}>
            <label className={LABEL}>Nome de quem solicita</label>
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
        <CardHeader className={`${CARD_H} flex flex-row items-center justify-between space-y-0`}>
          <CardTitle className="text-sm text-white">Pessoas autorizadas para retirada</CardTitle>
          <button
            type="button"
            onClick={() =>
              setAutorizadas((rows) => [...rows, { nome: "", cpf: "", placaCavalo: "", placaCarreta: "" }])
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-zinc-200 hover:border-sky-400/50 hover:text-white"
            aria-label="Adicionar pessoa autorizada"
          >
            <Plus className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <p className="text-[11px] text-zinc-500">Opcional. Quem pode retirar a unidade neste walk-in.</p>
          {autorizadas.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-1 items-end gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]"
            >
              <div>
                <label className={LABEL}>Nome</label>
                <Input
                  value={p.nome}
                  onChange={(e) =>
                    setAutorizadas((rows) => {
                      const next = [...rows];
                      next[i] = { ...next[i], nome: e.target.value };
                      return next;
                    })
                  }
                  className="bg-black/40"
                />
              </div>
              <div>
                <label className={LABEL}>CPF</label>
                <Input
                  value={p.cpf}
                  onChange={(e) =>
                    setAutorizadas((rows) => {
                      const next = [...rows];
                      next[i] = { ...next[i], cpf: e.target.value };
                      return next;
                    })
                  }
                  className="bg-black/40"
                />
              </div>
              <div>
                <label className={LABEL}>Placa cavalo</label>
                <Input
                  value={p.placaCavalo}
                  onChange={(e) =>
                    setAutorizadas((rows) => {
                      const next = [...rows];
                      next[i] = { ...next[i], placaCavalo: e.target.value.toUpperCase() };
                      return next;
                    })
                  }
                  className="bg-black/40"
                />
              </div>
              <div>
                <label className={LABEL}>Placa carreta</label>
                <Input
                  value={p.placaCarreta}
                  onChange={(e) =>
                    setAutorizadas((rows) => {
                      const next = [...rows];
                      next[i] = { ...next[i], placaCarreta: e.target.value.toUpperCase() };
                      return next;
                    })
                  }
                  className="bg-black/40"
                />
              </div>
              <div>
                {autorizadas.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setAutorizadas((rows) => rows.filter((_, idx) => idx !== i))}
                    className="mb-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:border-red-400/40 hover:text-red-300"
                    aria-label="Remover pessoa"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Registrando…" : "Registrar operação"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
