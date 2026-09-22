"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Camera } from "lucide-react";
import {
  formatTipoTamanhoContainerLabel,
  normalizeTamanhoContainer,
  resolveTipoContainerCodigo,
  TAMANHOS_CONTAINER_OPCOES,
} from "@/lib/cadastros/tipo-container-tamanhos";
import { formatCPF, formatCNPJ } from "@/lib/cadastros/formatters";
import {
  fetchCatalogosConferencia,
  postCorrecoesGate,
  type CatalogoTipoContainer,
  type CatalogoTransportadora,
  type ConferenciaCampo,
  type ConferenciaStatus,
  type OcrIndicativoTipo,
  type OperacaoDto,
} from "@/lib/gate/operacao-api";
import { cn } from "@/lib/utils";
import { formatIsoDisplay } from "@/lib/container-display";
import { rotuloTomadaPedido } from "@/lib/cadastros/tomada-display";
import { TomadaPedidoBadge } from "@/components/gate/tomada-pedido-badge";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ControleEntradaSaidaFotoZoom } from "@/components/gate/controle-entrada-saida-foto-zoom";
import { NavioAutocompleteInput } from "@/components/catalogo/navio-autocomplete-input";

const FORM = "grid grid-cols-12 gap-x-2 gap-y-1.5";
const LABEL = "mb-0.5 block text-[11px] font-medium leading-tight text-slate-300";

const FOTO_TIPOS: Record<string, string[]> = {
  container: ["CONTAINER_OCR"],
  placaCavalo: ["PLACA_CAVALO_OCR", "PLACA_OCR"],
  placaCarreta: ["PLACA_CARRETA_OCR", "PLACA_CARRETA01_OCR", "PLACA_CARRETA_01_OCR"],
  placaCarreta02: ["PLACA_CARRETA_02_OCR", "PLACA_CARRETA02_OCR"],
  lacre: ["LACRE_OCR", "LACRE"],
};

const CAMPO_POR_FOTO: Record<string, ConferenciaCampo["campo"]> = {
  CONTAINER_OCR: "container",
  PLACA_OCR: "placaCavalo",
  PLACA_CAVALO_OCR: "placaCavalo",
  PLACA_CARRETA_OCR: "placaCarreta",
  PLACA_CARRETA01_OCR: "placaCarreta",
  PLACA_CARRETA_01_OCR: "placaCarreta",
  PLACA_CARRETA_02_OCR: "placaCarreta02",
  PLACA_CARRETA02_OCR: "placaCarreta02",
  LACRE_OCR: "lacre",
  LACRE: "lacre",
};

type CampoOcrRic = "container" | "placaCavalo" | "placaCarreta" | "placaCarreta02" | "lacre";

type FotoAberta = {
  titulo: string;
  imagem: string;
  conferencia?: {
    campo: CampoOcrRic;
    label: string;
    solicitado: string;
    capturado: string;
  };
};

function campoOcrRic(campo: ConferenciaCampo["campo"] | undefined): CampoOcrRic | null {
  if (campo === "placa" || campo === "placaCavalo") return "placaCavalo";
  if (campo === "container" || campo === "placaCarreta" || campo === "placaCarreta02" || campo === "lacre") {
    return campo;
  }
  return null;
}

function formatarValorConferencia(campo: CampoOcrRic, valor: string): string {
  const v = String(valor ?? "").trim();
  if (!v || v === "—") return "—";
  if (campo === "container") return formatIsoDisplay(v);
  return v;
}

const TIPOS_LADO = ["LADO_FRONTAL", "LADO_TRASEIRO", "LADO_DIREITO", "LADO_ESQUERDO"] as const;
const TIPOS_CABO_TOMADA = ["CABO_TOMADA", "CABO_REEFER", "TOMADA_REEFER"] as const;
const ALERTA_CABO_TOMADA =
  "Falta a foto do cabo da tomada — a portaria precisa fotografar o cabo na tomada (reefer, ligado ou não).";

const FOTO_LABEL: Record<string, string> = {
  CONTAINER_OCR: "Contêiner",
  PLACA_OCR: "Placa cavalo",
  PLACA_CAVALO_OCR: "Placa cavalo",
  PLACA_CARRETA_OCR: "Placa carreta",
  PLACA_CARRETA01_OCR: "Placa carreta",
  PLACA_CARRETA_01_OCR: "Placa carreta",
  PLACA_CARRETA_02_OCR: "Placa carreta 02",
  PLACA_CARRETA02_OCR: "Placa carreta 02",
  LACRE_OCR: "Lacre",
  LACRE: "Lacre",
  CABO_TOMADA: "Cabo da tomada",
  CABO_REEFER: "Cabo da tomada",
  TOMADA_REEFER: "Cabo da tomada",
  LADO_FRONTAL: "Frontal",
  LADO_TRASEIRO: "Traseiro",
  LADO_DIREITO: "Lado direito",
  LADO_ESQUERDO: "Lado esquerdo",
};

type FotoItem = { tipo: string; imagem: string; ocrResult?: string };

function fotoPorTipos(fotos: FotoItem[], tipos: string[]): FotoItem | null {
  for (const tipo of tipos) {
    const hit = fotos.find((f) => f.tipo === tipo);
    if (hit) return hit;
  }
  return null;
}

function bordaOcr(status?: ConferenciaStatus): string {
  if (status === "CONFERE") return "border-emerald-500";
  if (status === "DIVERGENTE") return "border-orange-500";
  return "border-white/15";
}

type SinalEdicao = "travado" | "livre" | "alterado";

function bordaSinalEdicao(sinal?: SinalEdicao): string | undefined {
  if (sinal === "travado") return "border-2 border-red-500";
  if (sinal === "livre") return "border-2 border-emerald-500";
  if (sinal === "alterado") return "border-2 border-orange-500";
  return undefined;
}

function formatarAgenda(dataRef: string | null | undefined, turno: string | null | undefined): string {
  if (!dataRef) return "—";
  const [y, m, d] = dataRef.split("-");
  const data = y && m && d ? `${d}/${m}/${y}` : dataRef;
  return turno ? `${data} · ${turno}` : data;
}

export type CorrecaoRascunho = {
  tipo?: string;
  tamanho?: string;
  situacao?: string;
  lacre?: string;
  booking?: string;
  processo?: string;
  navio?: string;
  placaCavalo?: string;
  placaCarreta?: string;
  placaCarreta02?: string;
  tipoCaminhao?: string;
  motorista?: string;
  cpf?: string;
  transportadoraId?: string;
  observacao?: string;
  confirmar?: string[];
};

export function ControleEntradaSaidaDossie({
  operacao,
  podeEditar = false,
  liberarOcr = false,
  onAtualizada,
  acoesGaleria,
  acoesAposFotos,
  gerenteToken,
  onRascunhoChange,
}: {
  operacao: OperacaoDto;
  podeEditar?: boolean;
  liberarOcr?: boolean;
  onAtualizada?: (op: OperacaoDto) => void;
  acoesGaleria?: ReactNode;
  acoesAposFotos?: ReactNode;
  gerenteToken?: string | null;
  onRascunhoChange?: (rascunho: CorrecaoRascunho) => void;
}) {
  const sol = operacao.dossie?.solicitacao;
  const por = operacao.dossie?.portaria;
  const [fotoAberta, setFotoAberta] = useState<FotoAberta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);
  const [tiposContainer, setTiposContainer] = useState<CatalogoTipoContainer[]>([]);
  const [transportadoras, setTransportadoras] = useState<CatalogoTransportadora[]>([]);
  const [rascunho, setRascunho] = useState<CorrecaoRascunho>({});
  const onRascunhoChangeRef = useRef(onRascunhoChange);
  onRascunhoChangeRef.current = onRascunhoChange;

  useEffect(() => {
    setRascunho({});
    onRascunhoChangeRef.current?.({});
  }, [liberarOcr, operacao.protocolo]);

  useEffect(() => {
    let cancelled = false;
    void fetchCatalogosConferencia()
      .then((c) => {
        if (cancelled) return;
        setTiposContainer(c.tiposContainer ?? []);
        setTransportadoras(c.transportadoras ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setTiposContainer([]);
        setTransportadoras([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fotos: FotoItem[] = useMemo(() => {
    const vistoria = operacao.vistoria?.fotos ?? [];
    const lacresPortaria = (por?.fotosLacre ?? []).map((imagem, i) => ({
      tipo: i === 0 ? "LACRE" : `LACRE_${i + 1}`,
      imagem,
    }));
    const extras = (por?.fotosExtras ?? []).map((imagem, i) => ({
      tipo: `EXTRA_${i + 1}`,
      imagem,
    }));
    return [...vistoria, ...lacresPortaria, ...extras];
  }, [operacao.vistoria?.fotos, por?.fotosExtras, por?.fotosLacre]);

  const byCampo = useMemo(
    () => Object.fromEntries((operacao.conferencia?.itens ?? []).map((i) => [i.campo, i])),
    [operacao.conferencia?.itens],
  ) as Partial<Record<ConferenciaCampo["campo"], ConferenciaCampo>>;

  const tipoCaminhao = rascunho.tipoCaminhao ?? sol?.tipoCaminhao;
  const rodotrem = String(tipoCaminhao ?? "").toUpperCase() === "RODOTREM";
  const tipoExibido = rascunho.tipo ?? sol?.tipo ?? operacao.containerTipo;
  const tamanhoExibido = rascunho.tamanho ?? sol?.tamanho ?? operacao.containerTamanho;
  const situacaoExibida = rascunho.situacao ?? sol?.situacao ?? operacao.containerSituacao;
  const situacaoCheia = String(situacaoExibida ?? "").trim().toUpperCase() === "CHEIO";
  const idLabel = operacao.unidadeProcesso?.label || sol?.unidadeProcessoLabel || "—";
  const checkinLabel = por?.checkinEm ? new Date(por.checkinEm).toLocaleString("pt-BR") : "—";
  const tipoTamanho =
    formatTipoTamanhoContainerLabel(
      tipoExibido,
      tamanhoExibido,
      tiposContainer.map((t) => t.codigo),
    ) ?? "—";
  const tomadaLabel = rotuloTomadaPedido({
    tipo: tipoExibido,
    refrigerado: sol?.refrigerado ?? operacao.containerRefrigerado,
    setPoint: sol?.setPoint ?? operacao.containerSetPoint,
    tipos: tiposContainer,
  });

  const usados = new Set(
    Object.values(FOTO_TIPOS)
      .flat()
      .filter((tipo) => fotos.some((f) => f.tipo === tipo)),
  );
  const lados = TIPOS_LADO.map((tipo) => fotos.find((f) => f.tipo === tipo)).filter(
    (f): f is FotoItem => Boolean(f),
  );
  const caboFoto = fotoPorTipos(fotos, [...TIPOS_CABO_TOMADA]);
  const caboObrigatorioAusente = Boolean(
    operacao.caboTomadaFotoObrigatoria && !operacao.caboTomadaFotoPresente,
  );
  const demaisExtras = fotos.filter(
    (f) =>
      !usados.has(f.tipo) &&
      !(TIPOS_LADO as readonly string[]).includes(f.tipo) &&
      !(TIPOS_CABO_TOMADA as readonly string[]).includes(f.tipo),
  );
  const mostrarGaleria =
    lados.length > 0 || demaisExtras.length > 0 || Boolean(operacao.caboTomadaFotoObrigatoria);

  function sinal(editavel: boolean, alterado = false): SinalEdicao | undefined {
    if (!liberarOcr) return undefined;
    if (!editavel) return "travado";
    return alterado ? "alterado" : "livre";
  }

  function aplicarRascunho(patch: CorrecaoRascunho) {
    setRascunho((prev) => {
      const next = { ...prev, ...patch };
      if (patch.confirmar?.length) {
        next.confirmar = [...new Set([...(prev.confirmar ?? []), ...patch.confirmar])];
      }
      onRascunhoChangeRef.current?.(next);
      return next;
    });
  }

  async function corrigir(patch: Parameters<typeof postCorrecoesGate>[1]): Promise<boolean> {
    if ("container" in patch && patch.container != null && liberarOcr) return false;
    if (liberarOcr) {
      aplicarRascunho(patch);
      return true;
    }
    if (salvandoRef.current) return false;
    salvandoRef.current = true;
    setSalvando(true);
    try {
      const next = await postCorrecoesGate(operacao.protocolo, {
        ...patch,
        ...(gerenteToken ? { gerenteToken } : {}),
      });
      onAtualizada?.(next);
      toast.success("Dado atualizado pelo Gate.");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a correção.");
      return false;
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  function abrir(foto: FotoItem, titulo?: string) {
    const label = titulo ?? FOTO_LABEL[foto.tipo] ?? foto.tipo.replace(/_/g, " ");
    const campoFoto = CAMPO_POR_FOTO[foto.tipo];
    const ocr = campoFoto
      ? (byCampo[campoFoto] ?? (campoFoto === "placaCavalo" ? byCampo.placa : undefined))
      : undefined;
    const campo = campoOcrRic(ocr?.campo ?? campoFoto);
    const conferir = Boolean(podeEditar && ocr?.status === "DIVERGENTE" && campo);
    setFotoAberta({
      titulo: label,
      imagem: foto.imagem,
      conferencia:
        conferir && campo && ocr
          ? {
              campo,
              label,
              solicitado: ocr.solicitado,
              capturado: ocr.capturado,
            }
          : undefined,
    });
  }

  async function confirmarConferencia(origem: "agendamento" | "ocr") {
    const conf = fotoAberta?.conferencia;
    if (!conf) return;
    let ok = false;
    if (origem === "ocr") {
      const valor = String(conf.capturado ?? "").trim();
      if (!valor || valor === "—") return;
      ok = await corrigir({ [conf.campo]: valor });
    } else {
      ok = await corrigir({ confirmar: [conf.campo] });
    }
    if (ok) setFotoAberta(null);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold">Dados da solicitação</h2>
        <div className="flex flex-wrap items-baseline gap-x-5 text-sm">
          <p>
            <span className="mr-1.5 text-[11px] font-medium text-muted-foreground">ID</span>
            <span className="font-semibold text-foreground">{idLabel}</span>
          </p>
          <p>
            <span className="mr-1.5 text-[11px] font-medium text-muted-foreground">Protocolo</span>
            <span className="font-mono text-xs text-muted-foreground">{operacao.protocolo}</span>
          </p>
          <p>
            <span className="mr-1.5 text-[11px] font-medium text-muted-foreground">Check-in</span>
            <span className="font-semibold text-foreground">{checkinLabel}</span>
          </p>
        </div>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        {liberarOcr
          ? "Vermelho = travado · Verde = pode alterar · Laranja = alterado nesta edição. Campos com OCR só conferem pela foto."
          : "Verde = conferido · Laranja = clique na foto para conferir (agendamento ou OCR)"}
      </p>

      <div className={FORM}>
        <BlocoTitulo>Unidade</BlocoTitulo>
        <Dado
          span="col-span-6 sm:col-span-4"
          label="Contêiner"
          value={formatIsoDisplay(sol?.container ?? operacao.containerNumero)}
          ocr={byCampo.container}
          foto={fotoPorTipos(fotos, FOTO_TIPOS.container)}
          onOpen={abrir}
          editavel={false}
          disabled={salvando}
          enfatizar
          podeConferir={podeEditar}
          sinalEdicao={sinal(false, Boolean(rascunho.confirmar?.includes("container")))}
        />
        <TipoTamanhoCampo
          span="col-span-6 sm:col-span-3"
          tipo={tipoExibido}
          tamanho={tamanhoExibido}
          label={tipoTamanho}
          catalogo={tiposContainer}
          editavel={podeEditar}
          disabled={salvando}
          sinalEdicao={sinal(podeEditar, rascunho.tipo != null || rascunho.tamanho != null)}
          ocrIndicativo={operacao.ocrIndicativos?.tipo}
          onChange={(next) => void corrigir(next)}
        />
        <Dado
          span="col-span-6 sm:col-span-2"
          label="Situação"
          value={situacaoExibida ?? "—"}
          editavel={podeEditar}
          disabled={salvando}
          sinalEdicao={sinal(podeEditar, rascunho.situacao != null)}
          opcoes={[
            { value: "CHEIO", label: "CHEIO" },
            { value: "VAZIO", label: "VAZIO" },
          ]}
          onCommit={(v) => void corrigir({ situacao: v })}
        />
        {situacaoCheia ? (
          <Dado
            span="col-span-6 sm:col-span-3"
            label="Lacre"
            value={
              rascunho.lacre ??
              (operacao.direcaoUnidade === "SAIDA"
                ? operacao.lacreTroca?.atual ?? sol?.lacre
                : sol?.lacre) ??
              ""
            }
            displayValue={
              (rascunho.lacre ??
                (operacao.direcaoUnidade === "SAIDA"
                  ? operacao.lacreTroca?.atual ?? sol?.lacre
                  : sol?.lacre)) || "—"
            }
            ocr={byCampo.lacre}
            foto={fotoPorTipos(fotos, FOTO_TIPOS.lacre)}
            fotoObrigatoriaAusente={Boolean(
              operacao.lacreFotoObrigatoria && !operacao.lacreFotoPresente,
            )}
            alertaFoto="Foto obrigatória — contêiner cheio (exceto IsoTank)"
            nota={operacao.lacreTroca?.texto}
            onOpen={abrir}
            editavel={false}
            disabled={salvando}
            podeConferir={podeEditar}
            sinalEdicao={sinal(false, rascunho.lacre != null || Boolean(rascunho.confirmar?.includes("lacre")))}
          />
        ) : null}
        {tomadaLabel ? (
          <div className="col-span-6 sm:col-span-3">
            <label className={LABEL}>Tomada</label>
            <div className="flex h-9 items-center">
              <TomadaPedidoBadge label={tomadaLabel} />
            </div>
          </div>
        ) : null}
        <Dado
          span="col-span-6 sm:col-span-2"
          label="Direção"
          value={operacao.direcaoUnidadeLabel || sol?.direcaoUnidadeLabel || "—"}
          destaque
          sinalEdicao={sinal(false)}
        />
        <Dado
          span="col-span-6 sm:col-span-3"
          label="Operação"
          value={sol?.tipoOperacao ?? operacao.tipoOperacaoLabel ?? "—"}
          destaque
          sinalEdicao={sinal(false)}
        />
        <Dado
          span="col-span-6 sm:col-span-4"
          label="Cliente"
          value={sol?.cliente ?? operacao.clienteNome}
          sinalEdicao={sinal(false)}
        />
        <Dado
          span="col-span-6 sm:col-span-3"
          label="Agendamento"
          value={formatarAgenda(sol?.dataRef, sol?.turno)}
          sinalEdicao={sinal(false)}
        />

        <BlocoTitulo>Navio, processo e booking</BlocoTitulo>
        <Dado
          span="col-span-6 sm:col-span-4"
          label="Navio"
          value={rascunho.navio ?? sol?.navio?.trim() ?? ""}
          displayValue={(rascunho.navio ?? sol?.navio)?.trim() || "—"}
          editavel={podeEditar}
          disabled={salvando}
          sinalEdicao={sinal(podeEditar, rascunho.navio != null)}
          navioAutocomplete="staff"
          onCommit={(v) => void corrigir({ navio: v })}
        />
        <Dado
          span="col-span-6 sm:col-span-4"
          label="Processo"
          value={rascunho.processo ?? sol?.processo?.trim() ?? ""}
          displayValue={(rascunho.processo ?? sol?.processo)?.trim() || "—"}
          editavel={podeEditar}
          disabled={salvando}
          sinalEdicao={sinal(podeEditar, rascunho.processo != null)}
          onCommit={(v) => void corrigir({ processo: v })}
        />
        <Dado
          span="col-span-6 sm:col-span-4"
          label="Booking"
          value={rascunho.booking ?? sol?.booking?.trim() ?? ""}
          displayValue={(rascunho.booking ?? sol?.booking)?.trim() || "—"}
          editavel={podeEditar}
          disabled={salvando}
          sinalEdicao={sinal(podeEditar, rascunho.booking != null)}
          onCommit={(v) => void corrigir({ booking: v })}
        />

        <BlocoTitulo>Transporte</BlocoTitulo>
        <Dado
          span="col-span-6 sm:col-span-4"
          label="Transportadora"
          value={
            rascunho.transportadoraId !== undefined
              ? rascunho.transportadoraId
              : (por?.transportadoraId ||
                (por?.transportadora && por.transportadora !== "—" ? por.transportadora : "") ||
                "")
          }
          displayValue={
            rascunho.transportadoraId !== undefined
              ? rascunho.transportadoraId
                ? (transportadoras.find((t) => t.id === rascunho.transportadoraId)?.label ?? "—")
                : "—"
              : por?.transportadora && por.transportadora !== "—"
                ? por.transportadora
                : "—"
          }
          editavel={podeEditar}
          disabled={salvando}
          sinalEdicao={sinal(podeEditar, rascunho.transportadoraId != null)}
          opcoes={[
            { value: "", label: "—" },
            ...transportadoras.map((t) => ({
              value: t.id,
              label: `${t.label} · ${formatCNPJ(t.cnpj)}`,
            })),
          ]}
          onCommit={(v) => void corrigir({ transportadoraId: v })}
        />
        <Dado
          span="col-span-6 sm:col-span-2"
          label="Caminhão"
          value={tipoCaminhao || "LS"}
          displayValue={
            rascunho.tipoCaminhao
              ? rascunho.tipoCaminhao === "RODOTREM"
                ? "Rodotrem"
                : "LS"
              : (sol?.tipoCaminhaoLabel ?? sol?.tipoCaminhao ?? "—")
          }
          editavel={podeEditar}
          disabled={salvando}
          sinalEdicao={sinal(podeEditar, rascunho.tipoCaminhao != null)}
          opcoes={[
            { value: "LS", label: "LS" },
            { value: "RODOTREM", label: "Rodotrem" },
          ]}
          onCommit={(v) => void corrigir({ tipoCaminhao: v })}
        />
        <Dado
          span={rodotrem ? "col-span-6 sm:col-span-2" : "col-span-6 sm:col-span-3"}
          label="Placa cavalo"
          value={rascunho.placaCavalo ?? sol?.placaCavalo ?? sol?.placa ?? operacao.placa}
          ocr={byCampo.placaCavalo ?? byCampo.placa}
          foto={fotoPorTipos(fotos, FOTO_TIPOS.placaCavalo)}
          onOpen={abrir}
          editavel={false}
          disabled={salvando}
          podeConferir={podeEditar}
          sinalEdicao={sinal(
            false,
            rascunho.placaCavalo != null || Boolean(rascunho.confirmar?.includes("placaCavalo")),
          )}
        />
        <Dado
          span={rodotrem ? "col-span-6 sm:col-span-2" : "col-span-6 sm:col-span-3"}
          label="Placa carreta"
          value={rascunho.placaCarreta ?? sol?.placaCarreta || ""}
          displayValue={(rascunho.placaCarreta ?? sol?.placaCarreta) || "—"}
          ocr={byCampo.placaCarreta}
          foto={fotoPorTipos(fotos, FOTO_TIPOS.placaCarreta)}
          onOpen={abrir}
          editavel={false}
          disabled={salvando}
          podeConferir={podeEditar}
          sinalEdicao={sinal(
            false,
            rascunho.placaCarreta != null || Boolean(rascunho.confirmar?.includes("placaCarreta")),
          )}
        />
        {rodotrem ? (
          <Dado
            span="col-span-6 sm:col-span-2"
            label="Placa carreta 02"
            value={rascunho.placaCarreta02 ?? sol?.placaCarreta02 || ""}
            displayValue={(rascunho.placaCarreta02 ?? sol?.placaCarreta02) || "—"}
            ocr={byCampo.placaCarreta02}
            foto={fotoPorTipos(fotos, FOTO_TIPOS.placaCarreta02)}
            onOpen={abrir}
            editavel={false}
            disabled={salvando}
            podeConferir={podeEditar}
            sinalEdicao={sinal(
              false,
              rascunho.placaCarreta02 != null || Boolean(rascunho.confirmar?.includes("placaCarreta02")),
            )}
          />
        ) : null}
        <Dado
          span={rodotrem ? "col-span-6 sm:col-span-4" : "col-span-6 sm:col-span-4"}
          label="Motorista"
          value={rascunho.motorista ?? sol?.motorista ?? operacao.motoristaNome}
          editavel={podeEditar}
          disabled={salvando}
          sinalEdicao={sinal(podeEditar, rascunho.motorista != null)}
          onCommit={(v) => void corrigir({ motorista: v })}
        />
        <Dado
          span="col-span-6 sm:col-span-2"
          label="CPF"
          value={rascunho.cpf ?? sol?.cpf ?? ""}
          displayValue={
            (rascunho.cpf ?? sol?.cpf) ? formatCPF(rascunho.cpf ?? sol?.cpf ?? "") : "—"
          }
          editavel={podeEditar}
          disabled={salvando}
          sinalEdicao={sinal(podeEditar, rascunho.cpf != null)}
          onCommit={(v) => void corrigir({ cpf: v })}
        />
      </div>

      <div
        className={cn(
          "mt-2 grid gap-3 border-t border-border pt-2",
          acoesGaleria ? "lg:grid-cols-2 lg:items-start" : null,
        )}
      >
        <div className="min-w-0 space-y-2">
          <ObservacaoCampo
            value={rascunho.observacao ?? operacao.observacaoGate ?? ""}
            efeitos={operacao.observacoesEfeito}
            editavel={podeEditar}
            disabled={salvando}
            sinalEdicao={sinal(podeEditar, rascunho.observacao != null)}
            onCommit={(v) => void corrigir({ observacao: v })}
          />
          {mostrarGaleria || acoesAposFotos ? (
            <div>
              {mostrarGaleria ? (
                <p className="mb-1.5 text-xs font-medium text-slate-300">Demais fotos da vistoria</p>
              ) : (
                <p className="mb-1.5 text-xs font-medium text-slate-300">Ações da RIC</p>
              )}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-start gap-2">
                  {lados.map((foto) => (
                    <FotoMini key={foto.tipo} foto={foto} onOpen={abrir} />
                  ))}
                  {caboFoto ? (
                    <FotoMini foto={caboFoto} onOpen={abrir} />
                  ) : caboObrigatorioAusente ? (
                    <div className="flex w-16 shrink-0 flex-col items-center gap-0.5">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-orange-500 text-orange-400"
                        title={ALERTA_CABO_TOMADA}
                      >
                        <Camera className="h-5 w-5" />
                      </div>
                      <span className="w-full truncate text-center text-[10px] text-orange-300">
                        Cabo da tomada
                      </span>
                    </div>
                  ) : null}
                  {demaisExtras.map((foto) => (
                    <FotoMini key={foto.tipo} foto={foto} onOpen={abrir} />
                  ))}
                </div>
                {acoesAposFotos ? (
                  <div className="ml-auto flex flex-wrap items-start justify-end gap-2">
                    {acoesAposFotos}
                  </div>
                ) : null}
              </div>
              {caboObrigatorioAusente ? (
                <p className="mt-1.5 text-[10px] text-orange-300">{ALERTA_CABO_TOMADA}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {acoesGaleria ? <div className="flex h-full flex-col">{acoesGaleria}</div> : null}
      </div>

      <Dialog open={Boolean(fotoAberta)} onOpenChange={(open) => !open && setFotoAberta(null)}>
        <DialogContent
          className={
            fotoAberta?.conferencia
              ? "max-h-[95vh] w-[calc(100vw-1.5rem)] max-w-6xl overflow-y-auto"
              : "max-w-3xl"
          }
        >
          <DialogHeader>
            <DialogTitle>{fotoAberta?.titulo ?? "Foto"}</DialogTitle>
          </DialogHeader>
          {fotoAberta ? (
            <div className="space-y-4">
              <ControleEntradaSaidaFotoZoom
                src={fotoAberta.imagem}
                alt={fotoAberta.titulo}
                compact={Boolean(fotoAberta.conferencia)}
              />
              {fotoAberta.conferencia ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/15 bg-black/30 px-4 py-4 sm:px-5 sm:py-5">
                      <p className="text-sm font-medium text-slate-400">Dados do agendamento</p>
                      <p className="mt-2 break-all font-mono text-2xl font-bold tracking-wide text-white sm:text-3xl">
                        {formatarValorConferencia(
                          fotoAberta.conferencia.campo,
                          fotoAberta.conferencia.solicitado,
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-4 sm:px-5 sm:py-5">
                      <p className="text-sm font-medium text-orange-300">Dados do OCR</p>
                      <p className="mt-2 break-all font-mono text-2xl font-bold tracking-wide text-white sm:text-3xl">
                        {formatarValorConferencia(
                          fotoAberta.conferencia.campo,
                          fotoAberta.conferencia.capturado,
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      className="min-h-11 flex-1"
                      disabled={salvando}
                      data-testid="confirmar-agendamento-ocr"
                      onClick={() => void confirmarConferencia("agendamento")}
                    >
                      Confirmar dados agendamento
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 flex-1 border-orange-500/50 text-orange-200 hover:bg-orange-500/10"
                      disabled={
                        salvando ||
                        !fotoAberta.conferencia.capturado ||
                        fotoAberta.conferencia.capturado === "—"
                      }
                      data-testid="confirmar-ocr"
                      onClick={() => void confirmarConferencia("ocr")}
                    >
                      Confirmar dados OCR
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 flex-1 border-red-500 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      disabled={salvando}
                      data-testid="cancelar-conferencia-ocr"
                      onClick={() => setFotoAberta(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FotoMini({
  foto,
  onOpen,
}: {
  foto: FotoItem;
  onOpen: (foto: FotoItem, titulo?: string) => void;
}) {
  const titulo = FOTO_LABEL[foto.tipo] ?? foto.tipo.replace(/_/g, " ").toLowerCase();
  return (
    <button
      type="button"
      onClick={() => onOpen(foto, titulo)}
      className="group flex w-16 shrink-0 flex-col items-center gap-0.5"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.imagem}
        alt={titulo}
        className="h-16 w-16 rounded-md border border-white/15 object-cover group-hover:border-primary/50"
      />
      <span className="w-full truncate text-center text-[10px] text-muted-foreground">{titulo}</span>
    </button>
  );
}

const OBSERVACAO_MAX = 2000;

function ObservacaoCampo({
  value,
  efeitos,
  editavel,
  disabled,
  onCommit,
  sinalEdicao,
}: {
  value: string;
  efeitos?: string[];
  editavel?: boolean;
  disabled?: boolean;
  onCommit: (valor: string) => void;
  sinalEdicao?: SinalEdicao;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const borda = bordaSinalEdicao(sinalEdicao) ?? "border-white/15";
  const lancamentos = (efeitos ?? []).map((x) => x.trim()).filter(Boolean);
  const lancamentosVisiveis = lancamentos.filter((l) => !value.trim().includes(l));

  function commitSeMudou() {
    const next = draft.trim();
    if (next === value.trim()) return;
    onCommit(next);
  }

  const textoLivre = value.trim();
  const vazio = !textoLivre && lancamentosVisiveis.length === 0;

  return (
    <div className="min-w-0">
      <label className={LABEL}>Observação</label>
      {editavel ? (
        <textarea
          value={draft}
          disabled={disabled}
          maxLength={OBSERVACAO_MAX}
          rows={3}
          placeholder="Opcional — particularidade da conferência"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitSeMudou}
          className={cn(
            inputClass(borda),
            "min-h-[4.5rem] w-full resize-y py-1.5 font-normal leading-snug",
          )}
        />
      ) : (
        <div
          className={cn(
            inputClass(borda),
            "min-h-[4.5rem] whitespace-pre-wrap font-normal leading-snug text-zinc-200",
          )}
        >
          {vazio
            ? "—"
            : [textoLivre, ...lancamentosVisiveis].filter(Boolean).join("\n")}
        </div>
      )}
      {editavel && lancamentosVisiveis.length > 0 ? (
        <div className="mt-1.5 space-y-1">
          {lancamentosVisiveis.map((linha) => (
            <p key={linha} className="text-[11px] leading-snug text-amber-200/90">
              {linha}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function inputClass(borda: string) {
  return cn(
    "min-h-[2rem] min-w-0 flex-1 rounded-md border bg-zinc-950 px-2 py-1 text-sm font-medium text-zinc-100 outline-none focus:ring-1 focus:ring-primary/40",
    borda,
  );
}

function TipoTamanhoCampo({
  span,
  tipo,
  tamanho,
  label,
  catalogo,
  editavel,
  disabled,
  onChange,
  sinalEdicao,
  ocrIndicativo,
}: {
  span: string;
  tipo: string;
  tamanho: string;
  label: string;
  catalogo: CatalogoTipoContainer[];
  editavel?: boolean;
  disabled?: boolean;
  onChange: (patch: { tipo?: string; tamanho?: string }) => void;
  sinalEdicao?: SinalEdicao;
  ocrIndicativo?: OcrIndicativoTipo | null;
}) {
  const tiposOpcoes = catalogo.map((t) => ({
    ...t,
    codigo: resolveTipoContainerCodigo(t.codigo) || t.codigo,
  }));
  const catalogCodigos = tiposOpcoes.map((t) => t.codigo);
  const tipoCodigo = resolveTipoContainerCodigo(tipo === "—" ? "" : tipo, catalogCodigos);
  const tam = normalizeTamanhoContainer(tamanho) || "20";
  if (tipoCodigo && !tiposOpcoes.some((t) => t.codigo === tipoCodigo)) {
    tiposOpcoes.unshift({
      codigo: tipoCodigo,
      nome: tipoCodigo,
      tamanhos: [...TAMANHOS_CONTAINER_OPCOES],
      tomadaReefer: false,
    });
  }
  const selecionado = tiposOpcoes.find((t) => t.codigo === tipoCodigo);
  const tamanhos = selecionado?.tamanhos?.length
    ? selecionado.tamanhos
    : [...TAMANHOS_CONTAINER_OPCOES];
  const tamanhosOpcoes = tamanhos.includes(tam) ? tamanhos : [tam, ...tamanhos];
  const [draftTipo, setDraftTipo] = useState(tipoCodigo);
  useEffect(() => setDraftTipo(tipoCodigo), [tipoCodigo]);

  const usarSelect = editavel && catalogo.length > 0;
  const borda = bordaSinalEdicao(sinalEdicao) ?? "border-white/15";

  return (
    <div className={cn("min-w-0", span)}>
      <label className={LABEL}>Tipo / tamanho</label>
      {usarSelect ? (
        <div className="flex items-stretch gap-1.5">
          <select
            value={tipoCodigo}
            disabled={disabled}
            title={tipoCodigo}
            onChange={(e) => {
              const nextTipo = e.target.value;
              const nextCat = tiposOpcoes.find((t) => t.codigo === nextTipo);
              const nextTams = nextCat?.tamanhos?.length
                ? nextCat.tamanhos
                : [...TAMANHOS_CONTAINER_OPCOES];
              if (nextTams.includes(tam)) {
                onChange({ tipo: nextTipo });
              } else {
                onChange({ tipo: nextTipo, tamanho: nextTams[0] });
              }
            }}
            className={cn(inputClass(borda), "min-w-[7.5rem]")}
          >
            {tiposOpcoes.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.codigo}
              </option>
            ))}
          </select>
          <select
            value={tamanhosOpcoes.includes(tam) ? tam : tamanhosOpcoes[0]}
            disabled={disabled}
            onChange={(e) => onChange({ tamanho: e.target.value })}
            className={cn(inputClass(borda), "w-[4.75rem] flex-none")}
          >
            {tamanhosOpcoes.map((op) => (
              <option key={op} value={op}>
                {op}&apos;
              </option>
            ))}
          </select>
        </div>
      ) : editavel ? (
        <div className="flex items-stretch gap-1.5">
          <input
            value={draftTipo}
            disabled={disabled}
            onChange={(e) => setDraftTipo(e.target.value.toUpperCase())}
            onBlur={() => {
              if (draftTipo.trim() && draftTipo.trim() !== tipoCodigo) onChange({ tipo: draftTipo.trim() });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className={inputClass(borda)}
          />
          <select
            value={
              (TAMANHOS_CONTAINER_OPCOES as readonly string[]).includes(tam) ? tam : "20"
            }
            disabled={disabled}
            onChange={(e) => onChange({ tamanho: e.target.value })}
            className={cn(inputClass(borda), "w-[4.75rem] flex-none")}
          >
            {TAMANHOS_CONTAINER_OPCOES.map((op) => (
              <option key={op} value={op}>
                {op}&apos;
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className={cn(inputClass(borda), "flex items-center")}>
          <span className="truncate">{label || "—"}</span>
        </div>
      )}
      {ocrIndicativo?.tipoIso || ocrIndicativo?.mgwKg ? (
        <p
          className={cn(
            "mt-1 text-[10px] leading-snug",
            ocrIndicativo.status === "CONFERE" && "text-emerald-600/90",
            ocrIndicativo.status === "DIVERGENTE" && "text-amber-600/90",
            ocrIndicativo.status === "SEM_CAPTURA" && "text-muted-foreground",
          )}
        >
          {ocrIndicativo.mensagem}
          {(ocrIndicativo.mgwKg || ocrIndicativo.taraKg || ocrIndicativo.payloadKg) && (
            <span className="mt-0.5 block text-muted-foreground">
              {[
                ocrIndicativo.mgwKg ? `MGW ${ocrIndicativo.mgwKg} kg` : null,
                ocrIndicativo.taraKg ? `Tara ${ocrIndicativo.taraKg} kg` : null,
                ocrIndicativo.payloadKg ? `Payload ${ocrIndicativo.payloadKg} kg` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </p>
      ) : null}
    </div>
  );
}

function BlocoTitulo({ children }: { children: ReactNode }) {
  return (
    <p className="col-span-12 mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 first:mt-0">
      {children}
    </p>
  );
}

function Dado({
  label,
  value,
  displayValue,
  span,
  ocr,
  foto,
  fotoObrigatoriaAusente,
  alertaFoto,
  nota,
  onOpen,
  editavel,
  disabled,
  opcoes,
  onCommit,
  destaque,
  enfatizar,
  sinalEdicao,
  podeConferir,
  navioAutocomplete,
}: {
  label: string;
  value: string;
  displayValue?: string;
  span: string;
  ocr?: ConferenciaCampo;
  foto?: FotoItem | null;
  fotoObrigatoriaAusente?: boolean;
  alertaFoto?: string;
  nota?: string;
  onOpen?: (foto: FotoItem, titulo: string) => void;
  editavel?: boolean;
  disabled?: boolean;
  opcoes?: Array<{ value: string; label: string }>;
  onCommit?: (valor: string) => void;
  destaque?: boolean;
  enfatizar?: boolean;
  sinalEdicao?: SinalEdicao;
  podeConferir?: boolean;
  navioAutocomplete?: "staff" | "portal";
}) {
  const mostrado = displayValue ?? value;
  const [draft, setDraft] = useState(value === "—" ? "" : value);
  useEffect(() => setDraft(value === "—" ? "" : value), [value]);
  const opcoesEfetivas =
    opcoes && value && value !== "—" && !opcoes.some((o) => o.value === value)
      ? [...opcoes, { value, label: mostrado || value }]
      : opcoes;
  const abrirConferencia = Boolean(podeConferir && ocr?.status === "DIVERGENTE" && foto && onOpen);

  const borda =
    bordaSinalEdicao(sinalEdicao) ??
    (fotoObrigatoriaAusente
      ? "border-orange-500"
      : ocr?.status
        ? bordaOcr(ocr.status)
        : destaque
          ? "border-orange-500"
          : "border-white/15");

  function commitSeMudou() {
    const next = draft.trim();
    const atual = (value === "—" ? "" : value).trim();
    if (!next || next === atual) return;
    onCommit?.(next);
  }

  return (
    <div className={cn("min-w-0", span)}>
      <label className={LABEL}>{label}</label>
      <div className="flex items-stretch gap-1.5">
        {editavel && opcoesEfetivas ? (
          <select
            value={value}
            disabled={disabled}
            onChange={(e) => onCommit?.(e.target.value)}
            className={inputClass(borda)}
          >
            {opcoesEfetivas.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        ) : editavel && navioAutocomplete ? (
          <NavioAutocompleteInput
            source={navioAutocomplete}
            value={draft}
            disabled={disabled}
            className={cn(inputClass(borda), enfatizar && "text-base font-bold")}
            onChange={setDraft}
            onBlur={commitSeMudou}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              commitSeMudou();
            }}
          />
        ) : editavel ? (
          <input
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitSeMudou}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              commitSeMudou();
            }}
            className={cn(inputClass(borda), enfatizar && "text-base font-bold")}
          />
        ) : abrirConferencia ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onOpen(foto, label)}
            className={cn(
              inputClass(borda),
              "flex items-center text-left hover:bg-white/5",
              enfatizar && "min-h-[2.35rem]",
            )}
            title="Abrir foto para conferir"
          >
            <span className={cn("truncate font-medium", enfatizar && "text-base font-bold tracking-wide")}>
              {mostrado || "—"}
            </span>
          </button>
        ) : (
          <div className={cn(inputClass(borda), "flex items-center", enfatizar && "min-h-[2.35rem]")}>
            <span className={cn("truncate font-medium", enfatizar && "text-base font-bold tracking-wide")}>
              {mostrado || "—"}
            </span>
          </div>
        )}
        {foto && onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(foto, label)}
            className={cn(
              "h-8 w-8 shrink-0 overflow-hidden rounded-md border hover:border-primary/50",
              ocr?.status === "DIVERGENTE" ? "border-orange-500" : "border-white/15",
            )}
            title={
              ocr?.status === "DIVERGENTE" ? `Conferir foto: ${label}` : `Ver foto: ${label}`
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.imagem} alt="" className="h-full w-full object-cover" />
          </button>
        ) : fotoObrigatoriaAusente ? (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-orange-500 text-orange-400"
            title={alertaFoto ?? `Foto obrigatória: ${label}`}
          >
            <Camera className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      {nota ? (
        <p className="mt-1 text-[10px] leading-snug text-amber-300">{nota}</p>
      ) : null}
      {fotoObrigatoriaAusente ? (
        <p className="mt-1 text-[10px] text-orange-300">
          {alertaFoto ?? `Foto obrigatória — ${label.toLowerCase()}`}
        </p>
      ) : abrirConferencia ? (
        <p className="mt-1 text-[10px] text-orange-300">Clique na foto para conferir</p>
      ) : null}
    </div>
  );
}
