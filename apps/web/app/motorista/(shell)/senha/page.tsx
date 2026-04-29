"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MobileHeader } from "@/components/motorista/mobile-header";
import { DigitalPinCard } from "@/components/motorista/digital-pin-card";
import { QrCodeCard } from "@/components/motorista/qr-code-card";
import { MobileAlert } from "@/components/motorista/mobile-alert";
import { motoristaFetchSolicitacao } from "@/lib/api/motorista-client";
import { getOrCreatePin, qrPayloadFromTrip } from "@/lib/motorista/pin-storage";
import { vibrateAlertPattern, vibrateShort } from "@/lib/motorista/haptics";

type Trip = {
  solicitacaoId: string;
  protocolo: string;
  pin: string;
  isos: string[];
  qr?: string;
};

function readTrip(sid: string | null): Trip | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("rl_motorista_last_trip");
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Trip;
    if (sid && j.solicitacaoId !== sid) return null;
    return j;
  } catch {
    return null;
  }
}

function SenhaInner() {
  const searchParams = useSearchParams();
  const sid = searchParams.get("sid");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    const t = readTrip(sid);
    if (t) {
      setTrip(t);
    } else if (sid) {
      const pin = getOrCreatePin(sid);
      setTrip({
        solicitacaoId: sid,
        protocolo: "—",
        pin,
        isos: [],
        qr: qrPayloadFromTrip({ solicitacaoId: sid, protocolo: "", pin }),
      });
    }
  }, [sid]);

  const qrData = useMemo(() => {
    if (!trip) return "";
    return trip.qr ?? qrPayloadFromTrip(trip);
  }, [trip]);

  useEffect(() => {
    if (!trip?.solicitacaoId) return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await motoristaFetchSolicitacao(trip.solicitacaoId);
        if (!alive) return;
        const st = String(s.status ?? "");
        setStatus(st);
        if (lastStatus.current && lastStatus.current !== st) {
          vibrateShort();
        }
        lastStatus.current = st;
        const proto = String(s.protocolo ?? trip.protocolo);
        if (proto && proto !== "—") {
          setTrip((prev) => (prev ? { ...prev, protocolo: proto } : prev));
        }
        const unidades = (s.unidades as { numeroIso?: string }[]) ?? [];
        const isos = unidades.map((u) => u.numeroIso).filter(Boolean) as string[];
        if (isos.length) {
          setTrip((prev) => (prev ? { ...prev, isos } : prev));
        }
      } catch {
        /* offline */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [trip?.solicitacaoId, trip?.protocolo]);

  useEffect(() => {
    if (status === "CONCLUIDO" || status === "APROVADO") {
      vibrateAlertPattern();
    }
  }, [status]);

  if (!trip) {
    return (
      <>
        <MobileHeader title="Senha eletrônica" />
        <div className="px-4 pt-6 text-slate-400">Faça o check-in primeiro ou informe ?sid= na URL.</div>
      </>
    );
  }

  return (
    <>
      <MobileHeader title="Senha eletrônica" />
      <main className="mx-auto max-w-lg space-y-4 px-3 pt-4">
        {status ? (
          <MobileAlert
            variant={status === "REJEITADO" ? "warn" : "info"}
            title={`Status: ${status}`}
            body="Atualização automática a cada 8s."
          />
        ) : null}

        <DigitalPinCard pin={trip.pin} protocolo={trip.protocolo} />

        {trip.isos.length ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">ISO(s)</p>
            <p className="font-mono text-lg text-white">{trip.isos.join(" · ")}</p>
          </div>
        ) : null}

        <QrCodeCard data={qrData} caption={trip.protocolo} />

        <MobileAlert
          variant="success"
          title="Apresente a tela no portão"
          body="O PIN é gerado neste aparelho. O terminal valida a solicitação pelo sistema."
        />
      </main>
    </>
  );
}

export default function MotoristaSenhaPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] bg-[#080a0d]" />}>
      <SenhaInner />
    </Suspense>
  );
}
