"use client";

import { useRef } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildQrCredencialPayload,
  credencialShareText,
  type CredencialMotoristaData,
} from "@/lib/credencial-motorista";
import {
  ContainerExtraUnitsBadge,
  ProtocolRefLabel,
} from "@/components/shared/operation-identity";
import { buildContainerPrimaryDisplay } from "@/lib/container-display";
import { formatContainerISO } from "@/utils/containerFormatter";
import { toast } from "@/lib/toast";
import { RlLogo } from "./rl-logo";

type Props = {
  open: boolean;
  onClose: () => void;
  credencial: CredencialMotoristaData | null;
};

function formatContainers(isos: string[]): string {
  return isos.map((iso) => formatContainerISO(iso) || iso).join(" · ");
}

export function CredencialMotoristaModal({ open, onClose, credencial }: Props) {
  const exportRef = useRef<HTMLDivElement>(null);

  async function handleShare() {
    if (!credencial) return;
    const text = credencialShareText(credencial);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Credencial motorista — RL Transportes",
          text,
        });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Credencial copiada — cole no WhatsApp.");
    } catch {
      /* usuário cancelou share */
    }
  }

  async function handleDownload() {
    if (!credencial || !exportRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `credencial-${credencial.protocolo}.png`;
      a.click();
    } catch {
      toast.error("Não foi possível gerar a imagem da credencial.");
    }
  }

  if (!credencial) return null;

  const qrValue = buildQrCredencialPayload(credencial);
  const containerDisplay = buildContainerPrimaryDisplay(credencial.containers);
  const containersFmt = formatContainers(credencial.containers);
  const placasFmt = credencial.placas.length ? credencial.placas.join(" · ") : "—";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md border-white/15 bg-zinc-950 p-0 sm:max-w-lg">
        <div className="rounded-lg bg-white p-5 text-zinc-950 sm:p-6">
          <div ref={exportRef} className="space-y-5 bg-white">
            <div className="flex flex-col items-center gap-2 text-center">
              <RlLogo className="h-14 w-14 bg-gradient-to-br from-cyan-400 to-sky-600 text-lg shadow-md shadow-cyan-500/25" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                RL Transportes
              </p>
            </div>

            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-xl font-bold text-zinc-950">
                Credencial de acesso
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-600">
                Dupla checagem na portaria — confira verbalmente os dados abaixo com o motorista.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border-4 border-zinc-900 bg-white p-3 shadow-inner sm:p-4">
                <QRCode value={qrValue} size={240} level="M" />
              </div>

              <div className="w-full space-y-3">
                <div className="text-center">
                  <ProtocolRefLabel protocolo={credencial.protocolo} className="text-zinc-500" />
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    <span className="font-mono text-2xl font-bold tracking-tight text-cyan-700">
                      {containerDisplay.primary}
                    </span>
                    {containerDisplay.extraCount > 0 ? (
                      <ContainerExtraUnitsBadge extraCount={containerDisplay.extraCount} />
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border-2 border-zinc-900 bg-zinc-50 px-4 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Cliente
                    </p>
                    <p className="text-lg font-bold leading-snug text-zinc-950">{credencial.cliente}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Motorista
                    </p>
                    <p className="text-lg font-bold leading-snug text-zinc-950">
                      {credencial.motorista}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Placas
                    </p>
                    <p className="font-mono text-xl font-bold text-zinc-950">{placasFmt}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Contêiner{credencial.containers.length > 1 ? "es" : ""}
                    </p>
                    <p className="font-mono text-lg font-bold leading-relaxed text-zinc-950">
                      {containersFmt}
                    </p>
                  </div>
                  <div className="border-t border-zinc-200 pt-3">
                    <p className="text-base font-semibold text-zinc-800">
                      {credencial.data} · Turno {credencial.turnoLabel}
                    </p>
                    <p className="text-sm text-zinc-600">{credencial.tipoOperacaoLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
              onClick={() => void handleShare()}
            >
              Compartilhar
            </Button>
            <Button
              type="button"
              className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800"
              onClick={() => void handleDownload()}
            >
              Baixar imagem
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
