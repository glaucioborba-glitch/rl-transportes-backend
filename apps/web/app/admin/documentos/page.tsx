"use client";

import { useEffect, useRef, useState } from "react";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import type { AdminDoc, AdminDocCategory } from "@/lib/admin/types";
import { readJson, writeJson, adminDocsKey } from "@/lib/admin/storage";
import { ContractCard } from "@/components/admin/contract-card";
import { ContractDocumentViewer } from "@/components/admin/contract-document-viewer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CATS: AdminDocCategory[] = ["Contratos", "Jurídico", "Financeiro", "Operacional", "Compliance"];

export default function AdminDocumentosPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [cat, setCat] = useState<AdminDocCategory>("Contratos");
  const [viewer, setViewer] = useState<{ url: string; nome: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [sigSaved, setSigSaved] = useState<string | null>(null);

  useEffect(() => {
    setDocs(readJson<AdminDoc[]>(adminDocsKey(), []));
  }, []);

  function persist(next: AdminDoc[]) {
    setDocs(next);
    writeJson(
      adminDocsKey(),
      next.map((d) => {
        const r = { ...d };
        delete r.blobUrl;
        return r;
      }),
    );
  }

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0f18";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
  }, [cat]);

  if (!allowed) return null;

  const filtered = docs.filter((d) => d.categoria === cat);

  function start(e: React.MouseEvent | React.TouchEvent) {
    drawing.current = true;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = "touches" in e ? e.touches[0] : e;
    const rect = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(p.clientX - rect.left, p.clientY - rect.top);
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = "touches" in e ? e.touches[0] : e;
    const rect = c.getBoundingClientRect();
    ctx.lineTo(p.clientX - rect.left, p.clientY - rect.top);
    ctx.stroke();
  }
  function end() {
    drawing.current = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-white">Documentos</h1>
        <p className="text-sm text-zinc-500">Repositório interno · upload e assinatura apenas no cliente.</p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              "rounded-t-lg px-3 py-2 text-xs font-bold uppercase",
              cat === c ? "bg-emerald-500/20 text-emerald-100" : "text-zinc-500 hover:bg-white/5",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <ContractCard title="Upload" subtitle={cat}>
        <label className="cursor-pointer text-sm text-emerald-400">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const url = URL.createObjectURL(f);
              persist([
                ...docs,
                { id: `doc-${Date.now()}`, categoria: cat, nome: f.name, createdAt: new Date().toISOString(), blobUrl: url },
              ]);
            }}
          />
          Incluir PDF
        </label>
      </ContractCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <ContractCard title="Biblioteca" subtitle={`${filtered.length} arquivo(s)`}>
          <ul className="space-y-2">
            {filtered.length === 0 ? <li className="text-sm text-zinc-500">Vazio nesta categoria.</li> : null}
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="text-left text-sm text-sky-400 hover:underline"
                  onClick={() => d.blobUrl && setViewer({ url: d.blobUrl, nome: d.nome })}
                >
                  {d.nome}
                </button>
                <span className="ml-2 text-[10px] text-zinc-600">{d.createdAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </ContractCard>
        <ContractCard title="Visualização" subtitle="PDF integrado">
          {viewer ? (
            <ContractDocumentViewer url={viewer.url} title={viewer.nome} />
          ) : (
            <p className="text-sm text-zinc-500">Selecione um arquivo na biblioteca.</p>
          )}
        </ContractCard>
      </div>
      <ContractCard title="Assinatura eletrônica (canvas)" subtitle="Representação gráfica apenas">
        <canvas
          ref={canvasRef}
          width={480}
          height={180}
          className="max-w-full cursor-crosshair rounded-lg border border-white/10 touch-none"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-zinc-600"
            onClick={() => {
              const c = canvasRef.current;
              if (!c) return;
              setSigSaved(c.toDataURL("image/png"));
            }}
          >
            Capturar assinatura
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const c = canvasRef.current;
              if (!c) return;
              const ctx = c.getContext("2d");
              if (!ctx) return;
              ctx.fillStyle = "#0a0f18";
              ctx.fillRect(0, 0, c.width, c.height);
              setSigSaved(null);
            }}
          >
            Limpar
          </Button>
        </div>
        {sigSaved ? <p className="mt-2 text-[10px] text-zinc-500">PNG em memória ({sigSaved.length} chars base64)</p> : null}
      </ContractCard>
    </div>
  );
}
