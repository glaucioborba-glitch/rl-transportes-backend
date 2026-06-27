"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GateVistoriaPhotoSlot } from "@/components/gate/gate-vistoria-photo-slot";
import {
  AVARIAS_RAPIDAS,
  VISTORIA_ANGULOS,
  type VistoriaAngulo,
} from "@/lib/gate-vistoria";

type GateVistoriaWizardProps = {
  titulo: string;
  conferencia: React.ReactNode;
  dadosGate: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (payload: { fotos: Record<VistoriaAngulo, File>; avarias: string[] }) => void;
  canConfirmExtra?: boolean;
};

export function GateVistoriaWizard({
  titulo,
  conferencia,
  dadosGate,
  confirmLabel,
  busy,
  onConfirm,
  canConfirmExtra = true,
}: GateVistoriaWizardProps) {
  const [step, setStep] = useState(0);
  const [fotos, setFotos] = useState<Partial<Record<VistoriaAngulo, File>>>({});
  const [avarias, setAvarias] = useState<string[]>([]);

  const fotosCompletas = useMemo(
    () => VISTORIA_ANGULOS.every((a) => Boolean(fotos[a.id])),
    [fotos],
  );

  function toggleAvaria(id: string) {
    setAvarias((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleConfirm() {
    if (!fotosCompletas) return;
    const full = {} as Record<VistoriaAngulo, File>;
    for (const a of VISTORIA_ANGULOS) {
      const f = fotos[a.id];
      if (f) full[a.id] = f;
    }
    onConfirm({ fotos: full, avarias });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="sticky top-0 z-10 -mx-4 border-b border-white/10 bg-[#050810]/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Vistoria Gate · PWA</p>
        <h1 className="text-xl font-bold text-white">{titulo}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Conferência", "4 Fotos", "Avarias", "Confirmar"].map((label, i) => (
            <span
              key={label}
              className={
                i === step
                  ? "rounded-full bg-cyan-500 px-3 py-1 text-xs font-semibold text-black"
                  : i < step
                    ? "rounded-full bg-emerald-600/30 px-3 py-1 text-xs text-emerald-200"
                    : "rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-500"
              }
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {step === 0 ? (
        <Card className="border-cyan-500/20 bg-[#0a1020]">
          <CardHeader>
            <CardTitle className="text-white">Conferência verbal</CardTitle>
            <CardDescription className="text-zinc-400">
              Confira protocolo, contêineres e autenticidade antes de fotografar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-base text-zinc-100">{conferencia}</CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="border-cyan-500/20 bg-[#0a1020]">
          <CardHeader>
            <CardTitle className="text-white">4 fotos obrigatórias</CardTitle>
            <CardDescription className="text-zinc-400">
              Câmera traseira · compressão automática (~300KB).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {VISTORIA_ANGULOS.map((a) => (
              <GateVistoriaPhotoSlot
                key={a.id}
                angulo={a.id}
                label={a.label}
                hint={a.hint}
                file={fotos[a.id]}
                onCapture={(file) => setFotos((prev) => ({ ...prev, [a.id]: file }))}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="border-amber-500/20 bg-[#0a1020]">
          <CardHeader>
            <CardTitle className="text-white">Avarias</CardTitle>
            <CardDescription className="text-zinc-400">Marque o que observar no contêiner.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {AVARIAS_RAPIDAS.map((a) => {
              const on = avarias.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAvaria(a.id)}
                  className={
                    on
                      ? "flex min-h-[56px] items-center gap-3 rounded-xl border-2 border-amber-400 bg-amber-500/20 px-4 py-3 text-left text-base font-semibold text-amber-50"
                      : "flex min-h-[56px] items-center gap-3 rounded-xl border-2 border-white/15 bg-black/40 px-4 py-3 text-left text-base font-medium text-zinc-200"
                  }
                >
                  <span
                    className={
                      on
                        ? "flex h-6 w-6 items-center justify-center rounded bg-amber-400 text-black"
                        : "h-6 w-6 rounded border border-white/30"
                    }
                  >
                    {on ? <CheckCircle2 className="h-4 w-4" /> : null}
                  </span>
                  {a.label}
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="border-emerald-500/20 bg-[#0a1020]">
          <CardHeader>
            <CardTitle className="text-white">Dados operacionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">{dadosGate}</CardContent>
        </Card>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 flex gap-3 border-t border-white/10 bg-[#050810]/95 p-4 backdrop-blur">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-14 flex-1 border-zinc-600 text-lg"
            onClick={() => setStep((s) => s - 1)}
          >
            <ChevronLeft className="mr-1 h-5 w-5" /> Voltar
          </Button>
        ) : (
          <div className="flex-1" />
        )}
        {step < 3 ? (
          <Button
            type="button"
            className="min-h-14 flex-1 bg-cyan-500 text-lg font-bold text-black hover:bg-cyan-400"
            disabled={step === 1 && !fotosCompletas}
            onClick={() => setStep((s) => s + 1)}
          >
            Próximo <ChevronRight className="ml-1 h-5 w-5" />
          </Button>
        ) : (
          <Button
            type="button"
            className="min-h-14 flex-1 bg-emerald-500 text-lg font-bold text-black hover:bg-emerald-400"
            disabled={busy || !fotosCompletas || !canConfirmExtra}
            onClick={handleConfirm}
          >
            {busy ? "Enviando…" : confirmLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
