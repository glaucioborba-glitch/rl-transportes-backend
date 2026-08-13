"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, PenTool } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  downloadRicPdf,
  fetchOperacao,
  postAssinatura,
  postLiberarOperacao,
  type OperacaoDto,
} from "@/lib/gate/operacao-api";
import { toast } from "@/lib/toast";

export default function RicPage({ params }: { params: { protocolo: string } }) {
  const router = useRouter();
  const protocolo = decodeURIComponent(params.protocolo);
  const [operacao, setOperacao] = useState<OperacaoDto | null>(null);
  const [assinando, setAssinando] = useState(false);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    void fetchOperacao(protocolo)
      .then(setOperacao)
      .catch(() => router.push("/operador/gate/dashboard"));
  }, [protocolo, router]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !assinando) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [assinando]);

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

  async function concluirRIC() {
    if (!assinatura) {
      toast.error("Captura de assinatura é obrigatória.");
      return;
    }
    setGerando(true);
    try {
      await postAssinatura(protocolo, assinatura);
      const pdfBlob = await downloadRicPdf(protocolo);
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RIC-${protocolo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      await postLiberarOperacao(protocolo);
      toast.success("RIC gerado! Operação liberada para empilhadeira.");
      router.push("/operador/gate/operacao");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar RIC.");
      setGerando(false);
    }
  }

  if (!operacao) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RIC — Relatório de Inspeção de Contêiner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {protocolo} · Capture a assinatura do motorista
          </p>
        </div>
        <Badge variant="neutral" className="border-blue-500/30 bg-blue-500/15 text-blue-400">
          Reconfirmado
        </Badge>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 border-b border-border pb-4 text-center">
          <h2 className="text-xl font-bold">RELATÓRIO DE INSPEÇÃO DE CONTÊINER</h2>
          <p className="text-sm text-muted-foreground">RL Transportes — Terminal de Apoio Logístico</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Contêiner:</span>{" "}
            <strong>{operacao.containerNumero}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Placa:</span> <strong>{operacao.placa}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Motorista:</span>{" "}
            <strong>{operacao.motoristaNome}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Cliente:</span>{" "}
            <strong>{operacao.clienteNome}</strong>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <PenTool className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Assinatura do Motorista</h2>
        </div>

        {!assinando ? (
          <button
            type="button"
            onClick={() => setAssinando(true)}
            className="w-full rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary/30"
          >
            <PenTool className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Toque para iniciar a captura de assinatura</p>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border-2 border-border bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full touch-none cursor-crosshair"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={limparAssinatura}>
                Limpar
              </Button>
            </div>
          </div>
        )}
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={!assinatura || gerando}
        onClick={() => void concluirRIC()}
      >
        {gerando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando RIC...
          </>
        ) : (
          <>
            <FileText className="mr-2 h-4 w-4" /> Gerar RIC e Liberar Operação
          </>
        )}
      </Button>
    </div>
  );
}
