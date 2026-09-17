"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MobileButton } from "@/components/motorista/mobile-button";
import { BigInput } from "@/components/motorista/big-input";
import { RlLogo } from "@/components/portal/rl-logo";
import { ApiError } from "@/lib/api/corporate-auth-client";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import {
  clearMotoristaGpsToken,
  motoristaGpsLogin,
  motoristaGpsMe,
  motoristaGpsParar,
  motoristaGpsPing,
  readMotoristaGpsToken,
  type MotoristaGpsSessao,
} from "@/lib/api/motorista-gps-client";

const PING_MS = 15_000;

type Fase = "loading" | "login" | "gps";

export default function MotoristaGpsPage() {
  const [fase, setFase] = useState<Fase>("loading");
  const [cpf, setCpf] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [motorista, setMotorista] = useState<MotoristaGpsSessao["motorista"] | null>(null);
  const [status, setStatus] = useState("Aguardando GPS…");
  const [enviando, setEnviando] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastPingRef = useRef(0);

  const enviarPosicao = useCallback(async (lat: number, lng: number, precisaoM?: number) => {
    const now = Date.now();
    if (now - lastPingRef.current < 8_000) return;
    lastPingRef.current = now;
    try {
      await motoristaGpsPing(lat, lng, precisaoM);
      setStatus(`Enviado às ${new Date().toLocaleTimeString("pt-BR")}`);
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao enviar posição");
    }
  }, []);

  const iniciarWatch = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setErr("Este celular não informa GPS.");
      return;
    }
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        void enviarPosicao(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (geoErr) => {
        setErr(geoErr.message || "Permita o acesso à localização.");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, [enviarPosicao]);

  useEffect(() => {
    const token = readMotoristaGpsToken();
    if (!token) {
      setFase("login");
      return;
    }
    void motoristaGpsMe()
      .then((me) => {
        setMotorista(me);
        setFase("gps");
      })
      .catch(() => {
        clearMotoristaGpsToken();
        setFase("login");
      });
  }, []);

  useEffect(() => {
    if (fase !== "gps") return;
    iniciarWatch();
    const interval = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => void enviarPosicao(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
      );
    }, PING_MS);
    return () => {
      window.clearInterval(interval);
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [fase, iniciarWatch, enviarPosicao]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setEnviando(true);
    try {
      const session = await motoristaGpsLogin(cpf, pin);
      setMotorista(session.motorista);
      setFase("gps");
    } catch (er) {
      setErr(er instanceof ApiError ? er.message : "Não foi possível entrar");
    } finally {
      setEnviando(false);
    }
  }

  async function onParar() {
    try {
      await motoristaGpsParar();
    } catch {
      /* segue o logout */
    }
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    clearMotoristaGpsToken();
    setMotorista(null);
    setFase("login");
    setStatus("Aguardando GPS…");
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#080a0d] px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <RlLogo className="h-14 w-14 text-lg" />
          <h1 className="text-2xl font-bold text-white">Localização</h1>
          <p className="text-sm text-slate-500">Motorista interno ou terceiro da RL</p>
        </div>

        {fase === "loading" ? <p className="text-center text-sm text-slate-500">Carregando…</p> : null}

        {fase === "login" ? (
          <form onSubmit={(e) => void onLogin(e)} className="space-y-4 rounded-3xl border border-white/10 bg-[#0c1018] p-5 shadow-xl">
            <BigInput
              label="CPF"
              type="text"
              autoComplete="username"
              inputMode="numeric"
              placeholder="CPF do cadastro"
              value={cpf}
              onChange={(e) => setCpf(formatCpfCnpjBr(e.target.value))}
              required
            />
            <BigInput
              label="PIN (4 últimos do CPF)"
              type="password"
              autoComplete="current-password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
            />
            {err ? <p className="text-sm text-red-400">{err}</p> : null}
            <MobileButton type="submit" disabled={enviando}>
              {enviando ? "Entrando…" : "Enviar localização"}
            </MobileButton>
            <p className="text-center text-xs text-slate-500">
              Deixe esta tela aberta no celular durante a viagem.
            </p>
          </form>
        ) : null}

        {fase === "gps" && motorista ? (
          <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0c1018] p-5 shadow-xl">
            <p className="text-lg font-semibold text-white">{motorista.nome}</p>
            <p className="text-sm text-slate-400">
              {motorista.tipo}
              {motorista.placaCavalo ? ` · ${motorista.placaCavalo}` : ""}
            </p>
            <p className="rounded-xl bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">{status}</p>
            {err ? <p className="text-sm text-red-400">{err}</p> : null}
            <MobileButton type="button" onClick={() => void onParar()}>
              Parar e sair
            </MobileButton>
            <p className="text-center text-xs text-slate-500">Não feche o navegador. O mapa da intranet atualiza sozinho.</p>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/motorista/login" className="text-slate-400 hover:underline">
            Check-in no terminal
          </Link>
        </p>
      </div>
    </div>
  );
}
