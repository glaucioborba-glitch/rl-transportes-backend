"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PortariaPhotoButton } from "@/components/operador/portaria/portaria-photo-button";
import { RlLogo } from "@/components/portal/rl-logo";
import { ApiError } from "@/lib/api/staff-client";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import {
  fetchPortariaPrevisao,
  mapCheckinResumo,
  parseQrCredencialPayload,
  portariaCheckin,
  resolveSolicitacaoByProtocolo,
  type PortariaCheckinResumo,
  type PortariaPrevisaoItem,
} from "@/lib/portaria/portaria-api";

const PORTARIA_ROLES = new Set(["OPERADOR_PORTARIA", "ADMIN", "GERENTE"]);
const SESSION_MS = 30 * 60 * 1000;
const SESSION_KEY = "rl_portaria_session_at";

function useDesktopWarning(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const check = () => setDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return desktop;
}

type ScanPhase = "idle" | "confirm" | "photos" | "success";

export function PortariaMobileScreen() {
  const router = useRouter();
  const user = useStaffAuthStore((s) => s.user);
  const clear = useStaffAuthStore((s) => s.clear);
  const isDesktop = useDesktopWarning();

  const [previsao, setPrevisao] = useState<PortariaPrevisaoItem[]>([]);
  const [loadingPrevisao, setLoadingPrevisao] = useState(true);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [resumo, setResumo] = useState<PortariaCheckinResumo | null>(null);
  const [manualProtocol, setManualProtocol] = useState("");
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fotoCaminhao, setFotoCaminhao] = useState<string | null>(null);
  const [fotoContainer, setFotoContainer] = useState<string | null>(null);
  const [fotoDocumento, setFotoDocumento] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const refreshPrevisao = useCallback(async () => {
    setLoadingPrevisao(true);
    try {
      setPrevisao(await fetchPortariaPrevisao());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar previsão");
    } finally {
      setLoadingPrevisao(false);
    }
  }, []);

  useEffect(() => {
    void refreshPrevisao();
  }, [refreshPrevisao]);

  useEffect(() => {
    if (!user) return;
    if (!PORTARIA_ROLES.has(user.role)) {
      toast.error("Perfil não autorizado na Portaria.");
      router.replace("/login/staff?next=/operador/portaria");
      return;
    }
    const started = Number(sessionStorage.getItem(SESSION_KEY) || "0");
    const now = Date.now();
    if (!started) {
      sessionStorage.setItem(SESSION_KEY, String(now));
      return;
    }
    if (now - started > SESSION_MS) {
      clear();
      clearStaffSessionCookie();
      sessionStorage.removeItem(SESSION_KEY);
      toast.message("Sessão da portaria expirada (30 min). Faça login novamente.");
      router.replace("/login/staff?next=/operador/portaria");
    }
  }, [user, clear, router]);

  function resetFluxo() {
    setPhase("idle");
    setResumo(null);
    setFotoCaminhao(null);
    setFotoContainer(null);
    setFotoDocumento(null);
    setManualProtocol("");
    void stopCamera();
  }

  async function stopCamera() {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function onQrDecoded(raw: string) {
    const payload = parseQrCredencialPayload(raw);
    if (!payload?.protocolo) {
      toast.error("QR Code inválido.");
      return;
    }
    await stopCamera();
    try {
      const row = await resolveSolicitacaoByProtocolo(payload.protocolo);
      if (!row) {
        toast.error("Solicitação não encontrada para este QR.");
        return;
      }
      setResumo(mapCheckinResumo(row));
      setPhase("confirm");
      toast.success("Credencial lida com sucesso");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao buscar solicitação");
    }
  }

  async function startQrScan() {
    if (isDesktop) {
      toast.message("Use um celular para escanear o QR Code.");
      return;
    }
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const Detector = (window as Window & { BarcodeDetector?: new (o: { formats: string[] }) => {
        detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      } }).BarcodeDetector;

      if (Detector && videoRef.current) {
        const detector = new Detector({ formats: ["qr_code"] });
        scanTimerRef.current = window.setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          void detector.detect(video).then((codes) => {
            const raw = codes[0]?.rawValue;
            if (raw) void onQrDecoded(raw);
          });
        }, 500);
      } else {
        toast.message("Câmera ativa. Cole o JSON do QR abaixo se a leitura automática não funcionar.");
      }
    } catch {
      toast.error("Não foi possível acessar a câmera.");
      setScanning(false);
    }
  }

  async function buscarManual() {
    const protocolo = manualProtocol.trim();
    if (!protocolo) return;
    try {
      const row = await resolveSolicitacaoByProtocolo(protocolo);
      if (!row) {
        toast.error("Protocolo não encontrado.");
        return;
      }
      setResumo(mapCheckinResumo(row));
      setPhase("confirm");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro na busca");
    }
  }

  async function liberarEntrada() {
    if (!resumo) return;
    if (!fotoCaminhao || !fotoContainer || !fotoDocumento) {
      toast.error("Capture as 3 fotos antes de liberar.");
      return;
    }
    const placa = resumo.placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (placa.length < 7) {
      toast.error("Placa inválida na credencial.");
      return;
    }
    setSubmitting(true);
    try {
      await portariaCheckin(resumo.id, {
        status: "CHEGOU_PORTARIA",
        timestamp: new Date().toISOString(),
        placa,
        motoristaNome: resumo.motorista !== "—" ? resumo.motorista : undefined,
        fotos: {
          caminhao: fotoCaminhao,
          container: fotoContainer,
          documento: fotoDocumento,
        },
      });
      setPhase("success");
      void refreshPrevisao();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao liberar entrada");
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    clear();
    clearStaffSessionCookie();
    sessionStorage.removeItem(SESSION_KEY);
    router.replace("/login/staff");
  }

  if (phase === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="rounded-full bg-emerald-500/20 p-6">
          <RlLogo className="h-14 w-14 text-2xl text-emerald-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Caminhão liberado</h1>
          <p className="mt-2 text-slate-400">Dirija-se ao Gate.</p>
        </div>
        <Button type="button" className="min-h-12 w-full max-w-xs" onClick={() => resetFluxo()}>
          Nova entrada
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <RlLogo className="h-9 w-9 text-base" />
          <div>
            <p className="text-sm font-semibold text-white">Portaria RL</p>
            <p className="text-xs text-slate-500">Check-in mobile</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => logout()} aria-label="Sair">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {isDesktop ? (
        <div className="mx-4 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A Portaria deve ser acessada por dispositivo móvel.
        </div>
      ) : null}

      <div className="space-y-4 px-4 pt-4">
        {/* Seção 1 — Previsão */}
        <Card className="border-white/10 bg-black/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base text-white">Previsão de Chegada</CardTitle>
            <Button type="button" variant="ghost" size="icon" onClick={() => void refreshPrevisao()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingPrevisao ? (
              <p className="text-sm text-slate-500">Carregando…</p>
            ) : previsao.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum agendamento confirmado para hoje.</p>
            ) : (
              <ul className="space-y-2">
                {previsao.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-white">
                      {p.horarioLabel} · {p.placa}
                    </p>
                    <p className="text-slate-400">{p.motorista}</p>
                    <p className="font-mono text-xs text-[var(--accent)]">{p.container}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Seção 2 — Check-in */}
        <Card className="border-white/10 bg-black/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">Check-in do Caminhão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {phase === "idle" ? (
              <>
                <Button
                  type="button"
                  className="min-h-14 w-full gap-2 text-base"
                  onClick={() => void startQrScan()}
                >
                  <QrCode className="h-6 w-6" />
                  Escanear QR Code
                </Button>
                {scanning ? (
                  <div className="overflow-hidden rounded-lg border border-white/10">
                    <video ref={videoRef} className="aspect-video w-full bg-black" playsInline muted />
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => void stopCamera()}
                    >
                      Cancelar câmera
                    </Button>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Ou informe o protocolo manualmente:</p>
                  <Input
                    className="border-white/15 bg-black/40"
                    placeholder="RL-2026-…"
                    value={manualProtocol}
                    onChange={(e) => setManualProtocol(e.target.value)}
                  />
                  <Button type="button" variant="outline" className="w-full" onClick={() => void buscarManual()}>
                    Buscar credencial
                  </Button>
                </div>
              </>
            ) : null}

            {resumo && phase !== "idle" ? (
              <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-xs uppercase tracking-wide text-emerald-200/80">Dados da credencial</p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-slate-500">Placa</dt>
                    <dd className="font-mono font-medium text-white">{resumo.placa}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Motorista</dt>
                    <dd className="text-white">{resumo.motorista}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500">Contêiner</dt>
                    <dd className="font-mono text-[var(--accent)]">{resumo.container}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500">Tipo / Tamanho</dt>
                    <dd className="text-white">{resumo.tipoTamanho}</dd>
                  </div>
                </dl>
                {phase === "confirm" ? (
                  <Button type="button" className="w-full" onClick={() => setPhase("photos")}>
                    Confirmar e tirar fotos
                  </Button>
                ) : null}
              </div>
            ) : null}

            {phase === "photos" ? (
              <div className="space-y-2">
                <PortariaPhotoButton
                  label="Foto do Caminhão"
                  captured={Boolean(fotoCaminhao)}
                  onCapture={setFotoCaminhao}
                />
                <PortariaPhotoButton
                  label="Foto do Contêiner"
                  captured={Boolean(fotoContainer)}
                  onCapture={setFotoContainer}
                />
                <PortariaPhotoButton
                  label="Foto do Documento"
                  captured={Boolean(fotoDocumento)}
                  onCapture={setFotoDocumento}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Seção 3 — Liberação */}
        {phase === "photos" ? (
          <Button
            type="button"
            className="min-h-14 w-full bg-emerald-600 text-base font-semibold hover:bg-emerald-500"
            disabled={submitting || !fotoCaminhao || !fotoContainer || !fotoDocumento}
            onClick={() => void liberarEntrada()}
          >
            {submitting ? "Liberando…" : "Liberar Entrada"}
          </Button>
        ) : null}

        {phase !== "idle" ? (
          <Button type="button" variant="ghost" className="w-full text-slate-400" onClick={() => resetFluxo()}>
            Cancelar check-in
          </Button>
        ) : null}
      </div>
    </div>
  );
}
