"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ssmaStorage } from "@/lib/ssma/storage";
import type { PtwRecord, PtwStatus, PtwType } from "@/lib/ssma/types";
import { toast } from "@/lib/toast";

const TIPOS: { v: PtwType; l: string }[] = [
  { v: "altura", l: "Trabalho em altura" },
  { v: "empilhadeira", l: "Empilhadeira" },
  { v: "confinado", l: "Espaço confinado" },
  { v: "manutencao", l: "Manutenção crítica" },
  { v: "patio_risco", l: "Atividade de risco no pátio" },
];

const EPIS = ["capacete", "bota", "luvas", "óculos", "cinto"];
const EPCS = ["cavalete", "cone", "tapume", "extintor"];

export function PtwForm({ onSaved }: { onSaved?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [tipo, setTipo] = useState<PtwType>("patio_risco");
  const [status, setStatus] = useState<PtwStatus>("rascunho");
  const [solicitante, setSolicitante] = useState("");
  const [executor, setExecutor] = useState("");
  const [area, setArea] = useState("");
  const [risco, setRisco] = useState("");
  const [nr, setNr] = useState("NR-35");
  const [epis, setEpis] = useState<string[]>(["capacete", "luvas"]);
  const [epcs, setEpcs] = useState<string[]>(["cone"]);
  const [validade, setValidade] = useState(() => new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10));

  const toggle = (arr: string[], v: string, fn: (x: string[]) => void) => {
    fn(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const clearSig = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  useEffect(() => {
    clearSig();
  }, [clearSig]);

  const startDraw = useCallback((e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return;
    drawing.current = true;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const r = c.getBoundingClientRect();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  }, []);

  const draw = useCallback((e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
  }, []);

  const endDraw = useCallback(() => {
    drawing.current = false;
  }, []);

  function save(sigRequired: boolean) {
    if (!solicitante.trim() || !executor.trim()) {
      toast.error("Preencha solicitante e executor.");
      return;
    }
    const c = canvasRef.current;
    const b64 = c ? c.toDataURL("image/png") : null;
    if (sigRequired && status !== "rascunho" && (!b64 || b64.length < 400)) {
      toast.error("Assine no canvas para avançar status.");
      return;
    }
    const now = new Date().toISOString();
    const row: PtwRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      status,
      tipo,
      solicitante: solicitante.trim(),
      executor: executor.trim(),
      area: area.trim(),
      risco: risco.trim(),
      nrAplicavel: nr,
      episObrigatorios: epis,
      epcsObrigatorios: epcs,
      assinaturaBase64: b64,
      validadeAte: validade,
    };
    const all = ssmaStorage.ptw.list();
    ssmaStorage.ptw.saveAll([row, ...all].slice(0, 50));
    toast.success("PTW salvo localmente.");
    clearSig();
    onSaved?.();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-[11px] text-zinc-500">
          Tipo PTW
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as PtwType)}
          >
            {TIPOS.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">
          Status
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as PtwStatus)}
          >
            <option value="rascunho">Rascunho</option>
            <option value="enviado">Enviado</option>
            <option value="aprovado">Aprovado</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">
          Validade
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
          />
        </label>
        <label className="text-[11px] text-zinc-500">
          Solicitante
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={solicitante}
            onChange={(e) => setSolicitante(e.target.value)}
          />
        </label>
        <label className="text-[11px] text-zinc-500">
          Executor
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={executor}
            onChange={(e) => setExecutor(e.target.value)}
          />
        </label>
        <label className="text-[11px] text-zinc-500">
          Área
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm" value={area} onChange={(e) => setArea(e.target.value)} />
        </label>
        <label className="text-[11px] text-zinc-500 sm:col-span-2">
          Tipo de risco principal
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={risco}
            onChange={(e) => setRisco(e.target.value)}
          />
        </label>
        <label className="text-[11px] text-zinc-500">
          NR aplicável
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm" value={nr} onChange={(e) => setNr(e.target.value)} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold text-zinc-500">EPIs obrigatórios</p>
          <div className="flex flex-wrap gap-2">
            {EPIS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => toggle(epis, x, setEpis)}
                className={`rounded-full px-3 py-1 text-xs ${epis.includes(x) ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-400"}`}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold text-zinc-500">EPCs obrigatórios</p>
          <div className="flex flex-wrap gap-2">
            {EPCS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => toggle(epcs, x, setEpcs)}
                className={`rounded-full px-3 py-1 text-xs ${epcs.includes(x) ? "bg-cyan-800 text-white" : "bg-zinc-800 text-zinc-400"}`}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-bold text-amber-400">Autorização digital</p>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="max-w-full cursor-crosshair touch-none rounded-lg border border-amber-500/30 bg-zinc-900"
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
        <Button type="button" variant="ghost" size="sm" className="mt-2 text-zinc-500" onClick={clearSig}>
          Limpar assinatura
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="border-zinc-600" onClick={() => save(false)}>
          Salvar rascunho
        </Button>
        <Button type="button" className="bg-amber-600 hover:bg-amber-500" onClick={() => save(true)}>
          Salvar com assinatura
        </Button>
      </div>
    </div>
  );
}
