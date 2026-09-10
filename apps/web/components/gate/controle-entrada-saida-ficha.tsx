"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle,
  FileText,
  Loader2,
  Pencil,
  PenTool,
  Repeat,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  downloadRicPdf,
  fetchOperacao,
  postAssinatura,
  postAutorizacaoGerente,
  postCorrecoesGate,
  postDevolverPortaria,
  postExcluirRic,
  postLiberarOperacao,
  postReconfirmar,
  postRejeitar,
  type OperacaoDto,
} from "@/lib/gate/operacao-api";
import { CessaoTitularidadeDialog } from "@/components/gate/cessao-titularidade-dialog";
import { sanitizeCorporateDocumento } from "@/lib/api/corporate-auth-client";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import { validarCPF } from "@/lib/br-documents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ControleEntradaSaidaDossie, type CorrecaoRascunho } from "@/components/gate/controle-entrada-saida-dossie";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/staff-client";

const MOTIVOS = [
  { value: "CONTAINER_DIVERGENTE", label: "Contêiner não confere" },
  { value: "PLACA_DIVERGENTE", label: "Placa não confere" },
  { value: "MOTORISTA_DIVERGENTE", label: "Motorista não confere" },
  { value: "AVARIA_CRITICA", label: "Avaria crítica impede operação" },
  { value: "FOTOS_ILLEGIVEIS", label: "Fotos ilegíveis — refazer vistoria" },
  { value: "OUTRO", label: "Outro motivo" },
];

const FOTOS_REFAZER_BASE: Array<{ tipo: string; label: string }> = [
  { tipo: "CONTAINER_OCR", label: "Contêiner" },
  { tipo: "PLACA_OCR", label: "Placa cavalo" },
  { tipo: "PLACA_CARRETA_OCR", label: "Placa carreta" },
  { tipo: "LACRE", label: "Lacre" },
  { tipo: "CABO_TOMADA", label: "Cabo da tomada" },
  { tipo: "LADO_FRONTAL", label: "Frontal" },
  { tipo: "LADO_TRASEIRO", label: "Traseiro" },
  { tipo: "LADO_DIREITO", label: "Lado direito" },
  { tipo: "LADO_ESQUERDO", label: "Lado esquerdo" },
];

function opcoesFotosRefazer(op: OperacaoDto): Array<{ tipo: string; label: string }> {
  const rodotrem = String(op.dossie?.solicitacao?.tipoCaminhao ?? "").toUpperCase() === "RODOTREM";
  return FOTOS_REFAZER_BASE.filter((item) => {
    if (item.tipo === "CABO_TOMADA") return Boolean(op.caboTomadaFotoObrigatoria);
    return true;
  }).concat(
    rodotrem ? [{ tipo: "PLACA_CARRETA_02_OCR", label: "Placa carreta 02" }] : [],
  );
}

export function ControleEntradaSaidaFicha({ protocolo }: { protocolo: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromConsulta = searchParams.get("from") === "consulta-ric";
  const [operacao, setOperacao] = useState<OperacaoDto | null>(null);
  const [editando, setEditando] = useState(false);
  const [gerenteToken, setGerenteToken] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<CorrecaoRascunho>({});
  const [motivoAberto, setMotivoAberto] = useState(false);
  const [motivoEdicao, setMotivoEdicao] = useState("");
  const [authAberto, setAuthAberto] = useState(false);
  const [authAcao, setAuthAcao] = useState<"editar" | "excluir">("editar");
  const [cessaoAberto, setCessaoAberto] = useState(false);
  const [authDoc, setAuthDoc] = useState("");
  const [authSenha, setAuthSenha] = useState("");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [devolverAberto, setDevolverAberto] = useState(false);
  const [fotosRefazer, setFotosRefazer] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [modoAssinatura, setModoAssinatura] = useState<"DIGITAL" | "MANUAL">("MANUAL");
  const [liberarErro, setLiberarErro] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    void fetchOperacao(protocolo)
      .then((op) => {
        setOperacao(op);
      })
      .catch(() => {
        toast.error("Operação não encontrada.");
        router.push("/operador/gate/controle-entrada-saida");
      })
      .finally(() => setLoading(false));
  }, [protocolo, router]);

  const divergentes = operacao?.conferencia?.itens.filter((i) => i.status === "DIVERGENTE") ?? [];
  const semLacreObrigatorio = Boolean(
    operacao?.lacreFotoObrigatoria && !operacao?.lacreFotoPresente,
  );
  const semCaboTomada = Boolean(
    operacao?.caboTomadaFotoObrigatoria && !operacao?.caboTomadaFotoPresente,
  );
  const podeValidar = operacao?.state === "AGUARDANDO_RECONFIRMACAO";
  const podeRic =
    operacao?.state === "RECONFIRMADA" || operacao?.state === "RIC_GERADO";
  const naPortaria =
    operacao?.state === "CHECKIN_PORTARIA" || operacao?.state === "VISTORIA_FOTOGRAFICA";
  const liberada =
    operacao?.state === "LIBERADA_OPERACAO" ||
    operacao?.state === "EM_OPERACAO" ||
    operacao?.state === "CONCLUIDA";
  const posRic =
    operacao?.state === "RECONFIRMADA" ||
    operacao?.state === "RIC_GERADO" ||
    liberada;
  const podeEditar = Boolean(podeValidar || (editando && posRic));
  const voltarHref = fromConsulta
    ? "/operador/gate/consulta-ric"
    : "/operador/gate/controle-entrada-saida";
  const voltarLabel = fromConsulta ? "Consulta RIC" : "Fila";

  function cancelarEdicao() {
    setEditando(false);
    setRascunho({});
    setGerenteToken(null);
    setMotivoAberto(false);
    setMotivoEdicao("");
    toast.success("Edição cancelada. Nada foi gravado.");
  }

  async function confirmarConcluirEdicao() {
    const motivo = motivoEdicao.trim();
    if (motivo.length < 8) {
      toast.error("Descreva o motivo da edição (mínimo 8 caracteres).");
      return;
    }
    if (!gerenteToken) {
      toast.error("Autorização de gerente expirada. Abra Editar de novo.");
      setMotivoAberto(false);
      setEditando(false);
      return;
    }
    setBusy(true);
    try {
      const next = await postCorrecoesGate(protocolo, {
        ...rascunho,
        motivo,
        gerenteToken,
      });
      setOperacao(next);
      setEditando(false);
      setRascunho({});
      setGerenteToken(null);
      setMotivoAberto(false);
      setMotivoEdicao("");
      toast.success("Edição gravada na auditoria.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gravar a edição.");
    } finally {
      setBusy(false);
    }
  }

  function abrirAuth(acao: "editar" | "excluir") {
    setAuthAcao(acao);
    setAuthDoc("");
    setAuthSenha("");
    setAuthErr(null);
    setAuthAberto(true);
  }

  async function confirmarAuthGerente() {
    const cpf = sanitizeCorporateDocumento(authDoc);
    if (cpf.length !== 11 || !validarCPF(cpf)) {
      setAuthErr("Informe um CPF válido de gerente.");
      return;
    }
    if (!authSenha.trim()) {
      setAuthErr("Informe a senha.");
      return;
    }
    setBusy(true);
    setAuthErr(null);
    try {
      const auth = await postAutorizacaoGerente(protocolo, authDoc, authSenha);
      setGerenteToken(auth.token);
      if (authAcao === "editar") {
        setAuthAberto(false);
        setAuthSenha("");
        setEditando(true);
        setRascunho({});
        toast.success("Gerente autorizado. Pode editar a RIC.");
        return;
      }
      const out = await postExcluirRic(protocolo, { gerenteToken: auth.token });
      setAuthAberto(false);
      setAuthSenha("");
      toast.success(`${out.idLabel} anulado. A RIC desta perna foi excluída.`);
      router.push(voltarHref);
    } catch (e) {
      const msg =
        e instanceof ApiError || e instanceof Error
          ? e.message
          : "Não foi possível autorizar o gerente.";
      setAuthErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function reimprimirRic() {
    setBusy(true);
    try {
      const pdfBlob = await downloadRicPdf(protocolo);
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RIC-${protocolo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("RIC reimpressa.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reimprimir a RIC.");
    } finally {
      setBusy(false);
    }
  }

  async function validar() {
    if (divergentes.length > 0) {
      toast.error("Há divergência entre solicitação e portaria. Recuse ou peça nova captura.");
      return;
    }
    if (semLacreObrigatorio) {
      toast.error(
        "Foto do lacre é obrigatória para contêiner cheio. IsoTank é a única exceção (lacre inacessível).",
      );
      return;
    }
    if (semCaboTomada) {
      toast.error(
        "Foto do cabo da tomada é obrigatória para contêiner reefer (ligado ou não).",
      );
      return;
    }
    setBusy(true);
    try {
      const next = await postReconfirmar(protocolo, { validadoGate: true });
      setOperacao(next);
      toast.success("Validado. Escolha o modo de assinatura e emita a RIC.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao validar.");
    } finally {
      setBusy(false);
    }
  }

  function abrirDevolver() {
    const pre: string[] = [];
    if (semCaboTomada) pre.push("CABO_TOMADA");
    if (semLacreObrigatorio) pre.push("LACRE");
    setFotosRefazer(pre);
    setDevolverAberto(true);
  }

  async function confirmarDevolver() {
    if (fotosRefazer.length === 0) {
      toast.error("Selecione ao menos uma foto para a portaria refazer.");
      return;
    }
    setBusy(true);
    try {
      const next = await postDevolverPortaria(protocolo, fotosRefazer);
      setOperacao(next);
      setDevolverAberto(false);
      toast.success("Devolvida à portaria. O check-in permanece; a portaria refaz só as fotos marcadas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível devolver à portaria.");
    } finally {
      setBusy(false);
    }
  }

  async function rejeitar() {
    if (!motivoRejeicao) {
      toast.error("Selecione o motivo da recusa.");
      return;
    }
    setBusy(true);
    try {
      await postRejeitar(protocolo, motivoRejeicao, "RECONFIRMACAO");
      toast.success("Operação recusada.");
      router.push("/operador/gate/controle-entrada-saida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao recusar.");
      setBusy(false);
    }
  }

  async function emitirRic() {
    if (modoAssinatura === "DIGITAL" && !assinatura) {
      toast.error("Assinatura do motorista é obrigatória no modo digital.");
      return;
    }
    setBusy(true);
    try {
      await postAssinatura(
        protocolo,
        modoAssinatura === "MANUAL"
          ? { modo: "MANUAL" }
          : { modo: "DIGITAL", assinatura: assinatura ?? undefined },
      );
      const pdfBlob = await downloadRicPdf(protocolo);
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RIC-${protocolo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      const next = await postLiberarOperacao(protocolo);
      setOperacao(next);
      setLiberarErro(null);
      toast.success("RIC emitida. Unidade liberada para baixa/coleta.");
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : "Erro ao emitir a RIC.";
      setLiberarErro(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const canvasReady = assinando;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasReady) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [canvasReady]);

  function pos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = pos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = pos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDraw() {
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setAssinatura(canvas.toDataURL());
  }

  function limparAssinatura() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setAssinatura(null);
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={voltarHref}
            className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> {voltarLabel}
          </Link>
          <h1 className="text-2xl font-bold">Controle de Entrada e Saída</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {operacao.unidadeProcesso?.label ? `${operacao.unidadeProcesso.label} · ` : ""}
            {operacao.direcaoUnidadeLabel ?? ""}
            {operacao.direcaoUnidadeLabel ? " · " : ""}
            {operacao.protocolo} · {operacao.tipoOperacaoLabel ?? operacao.tipoOperacao} ·{" "}
            {operacao.clienteNome}
          </p>
        </div>
        <Badge variant="neutral">{operacao.stateLabel}</Badge>
      </div>
      {editando && posRic ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Edição após a RIC é excepcional. Cliente, operação, direção, ID e contêiner permanecem
          travados. Concluir pede o motivo e grava na auditoria; Cancelar descarta tudo.
        </p>
      ) : null}

      {liberarErro ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {liberarErro}
        </p>
      ) : null}

      {naPortaria ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {operacao.devolucaoPortaria?.mensagem ??
            "A portaria ainda está capturando esta unidade. A validação do Gate só começa depois da vistoria."}
        </p>
      ) : null}

      {podeValidar && semLacreObrigatorio ? (
        <p className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
          Foto do lacre é obrigatória para contêiner cheio — garantia legal da operação. IsoTank é a
          única exceção (lacre inacessível). Devolva à portaria para complementar a foto.
        </p>
      ) : null}

      {podeValidar && semCaboTomada ? (
        <p className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
          Foto do cabo da tomada é obrigatória para reefer (ligado ou não) — material de alto valor.
          Devolva à portaria para complementar a foto; a operação não é recusada.
        </p>
      ) : null}

      {divergentes.length > 0 ? (
        <p className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
          {divergentes.length} campo(s) de OCR divergente(s) da solicitação. Não é possível emitir a
          RIC até recusar ou receber nova captura.
        </p>
      ) : null}

      <ControleEntradaSaidaDossie
        key={editando ? `edit-${protocolo}` : `view-${protocolo}`}
        operacao={operacao}
        podeEditar={podeEditar}
        liberarOcr={editando && posRic}
        gerenteToken={gerenteToken}
        onRascunhoChange={setRascunho}
        onAtualizada={setOperacao}
        acoesAposFotos={
          posRic ? (
            <>
              {liberada || operacao.state === "RIC_GERADO" ? (
                <AcaoQuad
                  label="Reimprimir RIC"
                  disabled={busy}
                  onClick={() => void reimprimirRic()}
                >
                  <FileText className="h-5 w-5" />
                </AcaoQuad>
              ) : null}
              {editando ? (
                <>
                  <AcaoQuad
                    label="Concluir edição"
                    tom="ativo"
                    disabled={busy}
                    onClick={() => {
                      setMotivoEdicao("");
                      setMotivoAberto(true);
                    }}
                  >
                    <Pencil className="h-5 w-5" />
                  </AcaoQuad>
                  <AcaoQuad
                    label="Cancelar edição"
                    disabled={busy}
                    onClick={cancelarEdicao}
                  >
                    <Ban className="h-5 w-5" />
                  </AcaoQuad>
                </>
              ) : (
                <AcaoQuad
                  label="Editar"
                  tom="amber"
                  disabled={busy}
                  onClick={() => abrirAuth("editar")}
                >
                  <Pencil className="h-5 w-5" />
                </AcaoQuad>
              )}
              <AcaoQuad
                label="Excluir"
                tom="vermelho"
                disabled={busy || editando}
                onClick={() => abrirAuth("excluir")}
              >
                <Trash2 className="h-5 w-5" />
              </AcaoQuad>
              {operacao.unidadeProcesso?.id ? (
                <AcaoQuad
                  label="Ceder"
                  disabled={busy || editando}
                  onClick={() => setCessaoAberto(true)}
                >
                  <Repeat className="h-5 w-5" />
                </AcaoQuad>
              ) : null}
            </>
          ) : null
        }
        acoesGaleria={
          podeValidar ? (
            <div className="flex h-full flex-col justify-start space-y-3 rounded-lg border border-border bg-zinc-950/40 p-4">
              <Button
                type="button"
                className="w-full"
                disabled={divergentes.length > 0 || semLacreObrigatorio || semCaboTomada || busy}
                onClick={() => void validar()}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Validar e seguir para a RIC
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-orange-500/40 text-orange-200 hover:bg-orange-500/10"
                disabled={busy}
                onClick={abrirDevolver}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Devolver à portaria
              </Button>
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs text-muted-foreground">Recusar operação</p>
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
                {motivoRejeicao ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 w-full border-red-500/30 text-red-400"
                    disabled={busy}
                    onClick={() => void rejeitar()}
                  >
                    <X className="mr-2 h-4 w-4" /> Recusar
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null
        }
      />

      {(operacao.vistoria?.avarias?.length ?? 0) > 0 ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-400">
            <AlertTriangle className="h-4 w-4" />
            {operacao.vistoria!.avarias.length} avaria(s)
          </p>
          <ul className="mt-2 space-y-1 text-xs text-red-200">
            {operacao.vistoria!.avarias.map((a, i) => (
              <li key={`${a.localizacao}-${i}`}>
                {a.localizacao}: {a.descricao}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {podeRic ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-bold">RIC — Recibo de Intercâmbio de Contêineres</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Documento obrigatório. Escolha como a RIC será assinada e emita o PDF para liberar a
              baixa/coleta.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Contêiner" value={operacao.containerNumero} />
            <Field label="Placa" value={operacao.placa} />
            <Field label="Motorista" value={operacao.motoristaNome} />
            <Field label="Cliente" value={operacao.clienteNome} />
          </div>
          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-base font-semibold">
              <PenTool className="h-5 w-5 text-primary" />
              Modo de assinatura
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-lg border-2 p-4 ${
                  modoAssinatura === "MANUAL"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <input
                  type="radio"
                  name="modo-assinatura-ric"
                  className="sr-only"
                  checked={modoAssinatura === "MANUAL"}
                  onChange={() => {
                    setModoAssinatura("MANUAL");
                    setAssinando(false);
                  }}
                />
                <p className="font-semibold">Assinatura manual</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A RIC é impressa e assinada no papel pelo motorista e pelo operador do Gate.
                </p>
              </label>
              <label
                className={`cursor-pointer rounded-lg border-2 p-4 ${
                  modoAssinatura === "DIGITAL"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <input
                  type="radio"
                  name="modo-assinatura-ric"
                  className="sr-only"
                  checked={modoAssinatura === "DIGITAL"}
                  onChange={() => setModoAssinatura("DIGITAL")}
                />
                <p className="font-semibold">Assinatura digital</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Capture a assinatura do motorista na tela.
                </p>
              </label>
            </div>
          </fieldset>
          {modoAssinatura === "MANUAL" ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              O PDF sai com dois campos em branco — motorista e operador. Imprima a RIC e colete as
              assinaturas no papel.
            </div>
          ) : !assinando ? (
            <button
              type="button"
              onClick={() => setAssinando(true)}
              className="w-full rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary/30"
            >
              <PenTool className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Toque para capturar a assinatura</p>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border-2 border-border bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full cursor-crosshair touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={limparAssinatura}>
                Limpar
              </Button>
            </div>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={(modoAssinatura === "DIGITAL" && !assinatura) || busy}
            onClick={() => void emitirRic()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Emitindo RIC...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" /> Emitir RIC e liberar baixa/coleta
              </>
            )}
          </Button>
        </div>
      ) : null}

      {liberada ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="font-semibold text-emerald-300">Unidade liberada para operação.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A RIC já foi emitida. O restante segue em Operação Ativa / Despacho.
          </p>
          <Link
            href="/operador/gate/operacao"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            Ir para Operação Ativa
          </Link>
        </div>
      ) : null}

      <Dialog open={devolverAberto} onOpenChange={setDevolverAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quais fotos a portaria deve refazer?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O check-in permanece. Só as fotos marcadas voltam para a portaria.
          </p>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {opcoesFotosRefazer(operacao).map((item) => {
              const checked = fotosRefazer.includes(item.tipo);
              return (
                <label key={item.tipo} className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setFotosRefazer((prev) =>
                        e.target.checked
                          ? [...prev, item.tipo]
                          : prev.filter((t) => t !== item.tipo),
                      );
                    }}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm">{item.label}</span>
                </label>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDevolverAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={busy || fotosRefazer.length === 0}
              onClick={() => void confirmarDevolver()}
            >
              Devolver
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={authAberto} onOpenChange={setAuthAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {authAcao === "excluir" ? "Excluir RIC — autorização" : "Editar RIC — autorização"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {authAcao === "excluir"
              ? "Anular esta RIC exige CPF e senha de gerente ou administrador. A sessão do operador não muda."
              : "Editar após a RIC exige CPF e senha de gerente ou administrador. A sessão do operador não muda."}
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmarAuthGerente();
            }}
          >
            <div>
              <label htmlFor="gerente-cpf" className="mb-1 block text-xs text-muted-foreground">
                CPF do gerente
              </label>
              <Input
                id="gerente-cpf"
                autoComplete="username"
                inputMode="numeric"
                value={authDoc}
                onChange={(e) => setAuthDoc(formatCpfBr(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label htmlFor="gerente-senha" className="mb-1 block text-xs text-muted-foreground">
                Senha
              </label>
              <Input
                id="gerente-senha"
                type="password"
                autoComplete="current-password"
                value={authSenha}
                onChange={(e) => setAuthSenha(e.target.value)}
              />
            </div>
            {authErr ? <p className="text-sm text-red-400">{authErr}</p> : null}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setAuthAberto(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={
                  authAcao === "excluir"
                    ? "flex-1 border-red-500/50 bg-red-600 text-white hover:bg-red-500"
                    : "flex-1"
                }
                disabled={busy}
              >
                {busy ? "Verificando..." : authAcao === "excluir" ? "Autorizar e excluir" : "Autorizar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={motivoAberto} onOpenChange={setMotivoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo da edição</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Descreva por que esta RIC precisa ser alterada. O texto e os campos mudados vão para a
            auditoria.
          </p>
          <textarea
            value={motivoEdicao}
            onChange={(e) => setMotivoEdicao(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Ex.: placa da carreta divergente do documento apresentado..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
          />
          <p className="text-[11px] text-muted-foreground">{motivoEdicao.trim().length}/2000</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setMotivoAberto(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={busy || motivoEdicao.trim().length < 8}
              onClick={() => void confirmarConcluirEdicao()}
            >
              {busy ? "Gravando..." : "Gravar edição"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {operacao.unidadeProcesso?.id ? (
        <CessaoTitularidadeDialog
          unidadeProcessoId={operacao.unidadeProcesso.id}
          open={cessaoAberto}
          onOpenChange={setCessaoAberto}
        />
      ) : null}
    </div>
  );
}

function AcaoQuad({
  label,
  tom = "neutro",
  disabled,
  onClick,
  children,
}: {
  label: string;
  tom?: "neutro" | "amber" | "vermelho" | "ativo";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const tomClass =
    tom === "vermelho"
      ? "border-red-500/70 text-red-400 hover:bg-red-500/10"
      : tom === "amber"
        ? "border-amber-500/70 text-amber-300 hover:bg-amber-500/10"
        : tom === "ativo"
          ? "border-primary bg-primary/15 text-primary"
          : "border-white/20 text-zinc-100 hover:border-primary/50";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex w-16 shrink-0 flex-col items-center gap-0.5 disabled:opacity-50"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-md border ${tomClass}`}
      >
        {children}
      </span>
      <span className="w-full text-center text-[10px] leading-tight text-muted-foreground">
        {label}
      </span>
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
