"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MobileHeader } from "@/components/motorista/mobile-header";
import { OperationHeader } from "@/components/motorista/operation-header";
import { StatusLegend } from "@/components/motorista/status-legend";
import { TimelineMobile, type TimelineStep } from "@/components/motorista/timeline-mobile";
import { ProofGallery } from "@/components/motorista/proof-gallery";
import { DigitalPinCard } from "@/components/motorista/digital-pin-card";
import { QrCodeCard } from "@/components/motorista/qr-code-card";
import { motoristaFetchSolicitacao } from "@/lib/api/motorista-client";
import { getOrCreatePin, qrPayloadFromTrip } from "@/lib/motorista/pin-storage";

function ts(v: unknown): string | null {
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString("pt-BR");
  }
  return null;
}

function buildTimeline(sol: Record<string, unknown>): TimelineStep[] {
  const portaria = sol.portaria as Record<string, unknown> | null | undefined;
  const gate = sol.gate as Record<string, unknown> | null | undefined;
  const patio = sol.patio as Record<string, unknown> | null | undefined;
  const saida = sol.saida as Record<string, unknown> | null | undefined;

  return [
    {
      key: "portaria",
      title: "Portaria",
      done: !!portaria,
      time: ts(portaria?.createdAt ?? portaria?.updatedAt),
      note: portaria ? `OCR: ${String(portaria.statusOcr ?? "—")}` : null,
    },
    {
      key: "gate",
      title: "Gate-In",
      done: !!gate,
      time: ts(gate?.createdAt ?? gate?.updatedAt),
      note: gate ? `RIC assinado: ${gate.ricAssinado ? "sim" : "não"}` : null,
    },
    {
      key: "patio",
      title: "Pátio",
      done: !!patio,
      time: ts(patio?.createdAt ?? patio?.updatedAt),
      note: patio
        ? `Quadra ${String(patio.quadra ?? "—")} · ${String(patio.fileira ?? "")} · ${String(patio.posicao ?? "")}`
        : null,
    },
    {
      key: "gateout",
      title: "Gate-Out",
      done: !!(patio && saida),
      time: saida ? ts(saida?.createdAt ?? saida?.updatedAt) : null,
      note: "Liberada após conclusão no pátio",
    },
    {
      key: "saida",
      title: "Saída",
      done: !!saida,
      time: ts(saida?.createdAt ?? saida?.updatedAt),
      note: null,
    },
  ];
}

function TrackingInner() {
  const searchParams = useSearchParams();
  const sidParam = searchParams.get("sid");
  const [sid, setSid] = useState(sidParam);
  const [sol, setSol] = useState<Record<string, unknown> | null>(null);
  const [hist, setHist] = useState<{ t: string; line: string }[]>([]);

  useEffect(() => {
    const fromStore = (() => {
      try {
        const raw = sessionStorage.getItem("rl_motorista_last_trip");
        if (!raw) return null;
        return (JSON.parse(raw) as { solicitacaoId?: string }).solicitacaoId ?? null;
      } catch {
        return null;
      }
    })();
    setSid(sidParam ?? fromStore);
  }, [sidParam]);

  useEffect(() => {
    if (!sid) return;
    let alive = true;
    const run = async () => {
      try {
        const s = await motoristaFetchSolicitacao(sid);
        if (!alive) return;
        setSol(s);
        const st = String(s.status ?? "");
        const pr = String(s.protocolo ?? "");
        setHist((h) => {
          const line = `${pr} — ${st}`;
          const t = new Date().toLocaleTimeString("pt-BR");
          if (h[0]?.line === line) return h;
          return [{ t, line }, ...h].slice(0, 12);
        });
      } catch {
        setSol(null);
      }
    };
    void run();
    const id = setInterval(() => void run(), 12000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [sid]);

  const clienteNome =
    (sol?.cliente as { nome?: string } | undefined)?.nome ?? (typeof sol?.cliente === "string" ? sol.cliente : null);
  const isos: string[] = ((sol?.unidades as { numeroIso?: string }[]) ?? [])
    .map((u) => u.numeroIso)
    .filter((x): x is string => Boolean(x && String(x).trim()));
  const pin = sid ? getOrCreatePin(sid) : "000000";
  const qr = sid && sol ? qrPayloadFromTrip({ solicitacaoId: sid, protocolo: String(sol.protocolo ?? ""), pin }) : "";

  return (
    <>
      <MobileHeader title="Tracking" />
      <main className="mx-auto max-w-lg space-y-5 px-3 pt-4">
        {!sid ? (
          <p className="text-slate-500">Informe ?sid= com abrir pelo check-in ou armazene viagem ativa.</p>
        ) : null}

        {sol ? (
          <>
            <OperationHeader
              cliente={clienteNome}
              isos={isos.length ? isos : ["—"]}
              tipo={null}
              status={String(sol.status ?? "")}
            />
            <StatusLegend />
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Linha do tempo</h2>
              <TimelineMobile steps={buildTimeline(sol)} />
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Provas digitais</h2>
              <ProofGallery
                title="Fotos portaria — caminhão"
                items={(sol.portaria as { fotosCaminhao?: unknown })?.fotosCaminhao ?? []}
              />
              <ProofGallery
                title="Fotos portaria — contêiner"
                items={(sol.portaria as { fotosContainer?: unknown })?.fotosContainer ?? []}
              />
              <ProofGallery title="Lacres" items={(sol.portaria as { fotosLacre?: unknown })?.fotosLacre ?? []} />
              <ProofGallery title="Avarias" items={(sol.portaria as { fotosAvarias?: unknown })?.fotosAvarias ?? []} />

              <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-300">
                <p className="font-semibold text-white">Assinatura / RIC (gate)</p>
                <p className="mt-1">
                  {(sol.gate as { ricAssinado?: boolean } | undefined)?.ricAssinado
                    ? "Assinatura digital registrada no sistema."
                    : "Ainda sem assinatura no gate."}
                </p>
              </div>

              {qr ? (
                <div className="grid gap-4">
                  <DigitalPinCard pin={pin} protocolo={String(sol.protocolo ?? "")} />
                  <QrCodeCard data={qr} />
                </div>
              ) : null}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Histórico (polling)</h2>
              <ul className="space-y-2">
                {hist.map((h, i) => (
                  <li key={`${h.t}-${i}`} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                    <span className="text-xs text-slate-500">{h.t}</span>
                    <p className="font-mono text-slate-200">{h.line}</p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : sid ? (
          <p className="text-slate-500">Carregando…</p>
        ) : null}
      </main>
    </>
  );
}

export default function MotoristaTrackingPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] bg-[#080a0d]" />}>
      <TrackingInner />
    </Suspense>
  );
}
