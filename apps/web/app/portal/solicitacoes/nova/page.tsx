"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/portal/portal-primitives";
import {
  ApiError,
  criarSolicitacaoV2,
  criarSolicitacaoV2ComAnexos,
  type CreateSolicitacaoV2Payload,
  fetchPortalCatalogoContainer,
  type PortalPatioSaldoItem,
} from "@/lib/api/portal-client";
import { catalogoContainerHint, patchFromCatalogo } from "@/lib/catalogo-container-iso";
import { toast } from "@/lib/toast";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatPhoneBr } from "@/lib/nfse/cliente-fiscal";
import { ContainerEstoqueSearch } from "@/components/portal/container-estoque-search";
import {
  ContainerRefrigeradoSelect,
  ContainerStatusSelect,
  ContainerTamanhoSelect,
  ContainerTipoSelect,
  findPortalTipo,
} from "@/components/portal/container-form-fields";
import { formatContainerISO, stripContainerISO } from "@/utils/containerFormatter";
import { fieldErrorForContainer, parseUnidadeEstoqueError } from "@/lib/solicitacao-estoque-error";
import { usePortalEstoqueCliente } from "@/hooks/use-portal-estoque-cliente";
import { PortalAgendamentoGuard } from "@/components/portal/portal-agendamento-guard";
import { useTenantTurnos } from "@/hooks/use-tenant-turnos";
import { resolveAgendamentoTurno } from "@/lib/api/tenant-config-client";
import { usePortalTiposContainer } from "@/hooks/use-portal-tipos-container";
import { formatTamanhoContainerDisplay, normalizeTamanhoContainer } from "@/lib/cadastros/tipo-container-tamanhos";
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

export default function NovaSolicitacaoCorporativaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tipoCaminhao, setTipoCaminhao] = useState<TipoCaminhao>("LS");

  const [nomeMotorista, setNomeMotorista] = useState("");
  const [cpfMotorista, setCpfMotorista] = useState("");
  const { hint: motoristaHint, bloqueio: motoristaBloqueio } = useMotoristaCpfAutofill({
    cpf: cpfMotorista,
    nome: nomeMotorista,
    setNome: setNomeMotorista,
    source: "portal",
  });
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta01, setPlacaCarreta01] = useState("");
  const [placaCarreta02, setPlacaCarreta02] = useState("");

  const [containers, setContainers] = useState<ContainerDraft[]>([emptyContainer(1)]);
  const [unidadeFieldErrors, setUnidadeFieldErrors] = useState<Record<number, string>>({});
  const [catalogoHints, setCatalogoHints] = useState<Record<number, string>>({});

  const [dataRef, setDataRef] = useState("");
  const { turnos } = useTenantTurnos();
  const [turno, setTurno] = useState("");

  const [solNome, setSolNome] = useState("");
  const [solTelefone, setSolTelefone] = useState("");
  const [solEmail, setSolEmail] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const { tipos: tiposContainer, loading: loadingTipos } = usePortalTiposContainer(true);
  const estoque = usePortalEstoqueCliente(true);

  const pessoa = usePessoaAutorizadaStore((s) => s.pessoa);
  const user = usePortalClienteAuthStore((s) => s.user);

  const containerCount = tipoCaminhao === "LS" ? 1 : 2;

  useEffect(() => {
    if (!turnos.length) return;
    setTurno((prev) => (prev && turnos.some((t) => t.id === prev) ? prev : turnos[0].id));
  }, [turnos]);

  useEffect(() => {
    if (!pessoa) return;
    setSolNome(pessoa.nome);
    setSolEmail(pessoa.email);
    if (pessoa.telefone) setSolTelefone(formatPhoneBr(pessoa.telefone));
  }, [pessoa]);

  useEffect(() => {
    if (tipoCaminhao === "LS") {
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
  }, [tipoCaminhao]);

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

  async function applyCatalogo(idx: number, iso: string) {
    try {
      const hit = await fetchPortalCatalogoContainer(iso);
      if (!hit) {
        setCatalogoHints((prev) => ({ ...prev, [idx]: "" }));
        return;
      }
      setCatalogoHints((prev) => ({ ...prev, [idx]: catalogoContainerHint(hit) }));
      setContainers((rows) => {
        const atual = rows[idx];
        if (!atual) return rows;
        const patch = patchFromCatalogo(atual, hit, tiposContainer.map((t) => t.codigo));
        if (!Object.keys(patch).length) return rows;
        const next = [...rows];
        next[idx] = { ...atual, ...patch };
        return next;
      });
    } catch {
      /* catálogo é só atalho */
    }
  }

  function applyEstoque(idx: number, item: PortalPatioSaldoItem | null) {
    if (!item) {
      updateContainer(idx, { unidade: "" });
      setCatalogoHints((prev) => ({ ...prev, [idx]: "" }));
      return;
    }
    updateContainer(idx, {
      unidade: formatContainerISO(item.unidadeIso),
      tipo: item.tipo?.trim().toUpperCase() ?? "",
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
    const ordens = containers.slice(0, containerCount);
    const payload: CreateSolicitacaoV2Payload = {
      tipoOperacao: "SOLICITAR_COLETA",
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
    };
    return payload;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (motoristaBloqueio) {
      toast.error(motoristaBloqueio);
      return;
    }
    const ordens = containers.slice(0, containerCount);
    const allowed = new Set(estoque.items.map((i) => stripContainerISO(i.unidadeIso)));
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
      const id = created.id;
      toast.success(files.length ? "Solicitação registrada com anexos." : "Solicitação registrada.");
      router.push(`/portal/solicitacoes/${id}`);
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

  return (
    <PortalAgendamentoGuard>
    <main className="mx-auto w-[90%] space-y-4 py-6">
      <SectionTitle
        title="Nova solicitação (corporativa)"
        description="Transporte LS ou Rodotrem define containers. Envio em uma única requisição com anexos (multipart)."
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/portal/solicitacoes">Voltar</Link>
        </Button>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <Card className="border-white/10 bg-black/25">
          <CardHeader className={CARD_H}>
            <CardTitle className="text-sm text-white">1 · Transporte</CardTitle>
          </CardHeader>
          <CardContent className={`${GRID} ${CARD_C}`}>
            <div className={SPAN2}>
              <label className="mb-1 block text-xs text-slate-500">Nome do motorista</label>
              <Input value={nomeMotorista} onChange={(e) => setNomeMotorista(e.target.value)} required className="bg-black/40" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">CPF (apenas dígitos)</label>
              <Input value={cpfMotorista} onChange={(e) => setCpfMotorista(e.target.value)} required minLength={11} className="bg-black/40" />
              {motoristaBloqueio ? (
                <p className="mt-1 text-[11px] text-red-400">{motoristaBloqueio}</p>
              ) : motoristaHint ? (
                <p className="mt-1 text-[11px] text-slate-400">{motoristaHint}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Tipo de caminhão</label>
              <select
                className={SELECT_CLS}
                value={tipoCaminhao}
                onChange={(e) => setTipoCaminhao(e.target.value as TipoCaminhao)}
              >
                <option value="LS">LS (1 container)</option>
                <option value="RODOTREM">Rodotrem (2 containers)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Placa cavalo</label>
              <Input value={placaCavalo} onChange={(e) => setPlacaCavalo(e.target.value)} required className="bg-black/40 uppercase" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Placa carreta 01</label>
              <Input value={placaCarreta01} onChange={(e) => setPlacaCarreta01(e.target.value)} required className="bg-black/40 uppercase" />
            </div>
            {tipoCaminhao === "RODOTREM" ? (
              <div>
                <label className="mb-1 block text-xs text-slate-500">Placa carreta 02</label>
                <Input value={placaCarreta02} onChange={(e) => setPlacaCarreta02(e.target.value)} required className="bg-black/40 uppercase" />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {containers.slice(0, containerCount).map((c, idx) => (
          <Card key={c.ordem} className="border-white/10 bg-black/25">
            <CardHeader className={CARD_H}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm text-white">2 · Contêiner #{c.ordem}</CardTitle>
                <div className="flex flex-wrap gap-1">
                  {c.refrigerado ? (
                    <span className="rounded bg-rose-600/35 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-100">
                      Reefer
                    </span>
                  ) : null}
                  {c.refrigerado && c.setPoint.trim() ? (
                    <span className="rounded bg-sky-600/40 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                      {c.setPoint.replace(",", ".")}°C
                    </span>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className={`${GRID} ${CARD_C}`}>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Unidade em estoque (deste cliente)</label>
                <ContainerEstoqueSearch
                  value={c.unidade}
                  onSelect={(item) => applyEstoque(idx, item)}
                  items={estoque.items}
                  loading={estoque.loading}
                  error={estoque.error}
                  excludeIsos={containers
                    .slice(0, containerCount)
                    .filter((_, i) => i !== idx)
                    .map((row) => row.unidade)}
                  required
                  className="bg-black/40"
                />
                {unidadeFieldErrors[idx] ? (
                  <p className="mt-1 text-xs text-red-400">{unidadeFieldErrors[idx]}</p>
                ) : catalogoHints[idx] ? (
                  <p className="mt-1 text-[11px] text-slate-400">{catalogoHints[idx]}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Booking (opcional)</label>
                <Input value={c.booking} onChange={(e) => updateContainer(idx, { booking: e.target.value })} className="bg-black/40" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Processo (opcional)</label>
                <Input value={c.processo} onChange={(e) => updateContainer(idx, { processo: e.target.value })} className="bg-black/40" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Navio (opcional)</label>
                <Input value={c.navio} onChange={(e) => updateContainer(idx, { navio: e.target.value })} className="bg-black/40" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Tipo</label>
                <ContainerTipoSelect
                  value={c.tipo}
                  onChange={(v) => updateContainer(idx, { tipo: v })}
                  required
                  selectClassName={SELECT_CLS}
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
                  selectClassName={SELECT_CLS}
                  tamanhos={findPortalTipo(tiposContainer, c.tipo)?.tamanhos ?? []}
                  disabled={!c.tipo}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Status</label>
                <ContainerStatusSelect
                  value={c.status}
                  onChange={(v) => updateContainer(idx, { status: v as "CHEIO" | "VAZIO" })}
                  selectClassName={SELECT_CLS}
                />
              </div>
              {c.status === "CHEIO" ? (
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Lacre</label>
                  <Input value={c.lacre} onChange={(e) => updateContainer(idx, { lacre: e.target.value })} required className="bg-black/40" />
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
                      selectClassName={SELECT_CLS}
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
            <CardTitle className="text-sm text-white">3 · Agendamento e contato</CardTitle>
            {pessoa && user?.cpfCnpj ? (
              <CardDescription>
                Responsável: {pessoa.nome} (CNPJ/CPF {formatCpfCnpjBr(user.cpfCnpj)})
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className={`${GRID} ${CARD_C}`}>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Data</label>
              <Input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} required className="bg-black/40" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Turno</label>
              <select
                className={SELECT_CLS}
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
              <Input value={solTelefone} onChange={(e) => setSolTelefone(e.target.value)} required className="bg-black/40" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">E-mail</label>
              <Input type="email" value={solEmail} onChange={(e) => setSolEmail(e.target.value)} required className="bg-black/40" />
            </div>
            <div className={SPAN2}>
              <label className="mb-1 block text-xs text-slate-500">Nome</label>
              <Input value={solNome} onChange={(e) => setSolNome(e.target.value)} required className="bg-black/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/25">
          <CardHeader className={CARD_H}>
            <CardTitle className="text-sm text-white">4 · Anexos (opcional)</CardTitle>
            <CardDescription>JPG ou PDF, até 5MB. Pode enviar sem anexos.</CardDescription>
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
              <p className="text-xs text-slate-500">Nenhum arquivo selecionado — opcional.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving} className="min-w-[180px]">
            {saving ? "Salvando…" : "Salvar solicitação"}
          </Button>
        </div>
      </form>
    </main>
    </PortalAgendamentoGuard>
  );
}
