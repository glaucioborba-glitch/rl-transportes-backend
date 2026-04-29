"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GateCard } from "@/components/operador/gate-card";
import { OperationalTimeline } from "@/components/operador/operational-timeline";
import { DigitalSignaturePad } from "@/components/operador/digital-signature-pad";
import { PhotoUploader, type PhotoEntry } from "@/components/operador/photo-uploader";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";

type Sol = {
  id: string;
  protocolo: string;
  status: string;
  cliente?: { nome?: string };
  unidades?: { id: string; numeroIso: string; tipo: string }[];
  portaria?: unknown;
  gate?: unknown;
  patio?: unknown;
  saida?: unknown;
};

export default function GatePage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Sol[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Sol | null>(null);
  const [mode, setMode] = useState<"in" | "out">("in");
  const [sig, setSig] = useState<string | null>(null);
  const [fotos, setFotos] = useState<PhotoEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await staffJson<{ items: Sol[] }>(`/solicitacoes?limit=100&page=1`);
      setRows(r.items ?? []);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter(
      (s) =>
        s.protocolo.toLowerCase().includes(qq) ||
        (s.unidades ?? []).some((u) => u.numeroIso.toLowerCase().includes(qq)),
    );
  }, [q, rows]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void (async () => {
      try {
        setDetail(await staffJson<Sol>(`/solicitacoes/${selectedId}`));
      } catch {
        setDetail(null);
      }
    })();
  }, [selectedId]);

  const ricPayload = useMemo(() => {
    if (!detail) return "";
    return JSON.stringify({
      tipo: "RIC_DIGITAL_RL",
      protocolo: detail.protocolo,
      solicitacaoId: detail.id,
      emitidoEm: new Date().toISOString(),
      assinatura: sig ? "[presente]" : null,
    });
  }, [detail, sig]);

  const qrSrc =
    ricPayload.length > 0
      ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(ricPayload)}`
      : "";

  async function gateIn() {
    if (!detail) return;
    if (!detail.portaria) {
      toast.error("Sem portaria registrada — prossiga apenas se o backend aceitar.");
    }
    if (!sig) {
      toast.error("Colete a assinatura do motorista.");
      return;
    }
    setBusy(true);
    try {
      await staffJson(`/solicitacoes/gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitacaoId: detail.id, ricAssinado: true }),
      });
      toast.success("Gate-IN registrado");
      const d = await staffJson<Sol>(`/solicitacoes/${detail.id}`);
      setDetail(d);
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha gate");
    } finally {
      setBusy(false);
    }
  }

  async function gateOut() {
    if (!detail) return;
    setBusy(true);
    try {
      await staffJson(`/solicitacoes/saida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitacaoId: detail.id, dataHoraSaida: new Date().toISOString() }),
      });
      toast.success("Saída registrada");
      const d = await staffJson<Sol>(`/solicitacoes/${detail.id}`);
      setDetail(d);
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha saída");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Operador · Gate</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0c0f14]">
          <CardHeader>
            <CardTitle className="text-white">Busca</CardTitle>
            <CardDescription>Protocolo ou ISO (lista local)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              className="min-h-12 border-white/15 bg-black/40 text-white"
              placeholder="Filtrar…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="max-h-72 space-y-2 overflow-auto">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`flex w-full min-h-14 flex-col rounded-xl border px-3 py-2 text-left transition-colors ${
                    selectedId === s.id ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10 bg-black/30"
                  }`}
                  onClick={() => setSelectedId(s.id)}
                >
                  <span className="font-mono text-white">{s.protocolo}</span>
                  <span className="text-xs text-slate-500">
                    {(s.unidades ?? []).map((u) => u.numeroIso).join(", ")}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <GateCard row={detail} />
      </div>

      {detail ? (
        <>
          {!detail.portaria ? (
            <Card className="border-amber-500/40 bg-amber-500/10">
              <CardContent className="py-4 text-amber-100">
                Alerta: esta solicitação ainda não possui registro de portaria. O backend pode validar o
                fluxo.
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-white/10 bg-[#0c0f14]">
            <CardHeader>
              <CardTitle className="text-white">Linha do tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <OperationalTimeline
                active={detail.gate ? "patio" : "gate"}
                portariaDone={!!detail.portaria}
                gateDone={!!detail.gate}
                patioDone={!!detail.patio}
                saidaDone={!!detail.saida}
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant={mode === "in" ? "default" : "outline"}
              className="min-h-12 flex-1"
              onClick={() => setMode("in")}
            >
              Gate-IN
            </Button>
            <Button
              type="button"
              variant={mode === "out" ? "default" : "outline"}
              className="min-h-12 flex-1"
              onClick={() => setMode("out")}
            >
              Gate-OUT / Saída
            </Button>
          </div>

          {mode === "in" ? (
            <Card className="border-white/10 bg-[#0c0f14]">
                <CardHeader>
                  <CardTitle className="text-white">Gate-IN</CardTitle>
                  <CardDescription>POST /solicitacoes/gate · ricAssinado após captura</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <PhotoUploader label="Foto contêiner (evidência local)" photos={fotos} onChange={setFotos} max={4} />
                  <div>
                    <p className="mb-2 text-sm text-slate-400">Assinatura digital (canvas → PNG)</p>
                    <DigitalSignaturePad onChangeBase64={(b) => setSig(b)} />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <p className="mb-2 text-sm font-medium text-white">RIC digital (JSON local + QR)</p>
                    <pre className="mb-3 max-h-24 overflow-auto text-[10px] text-slate-500">{ricPayload}</pre>
                    {qrSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrSrc} alt="QR RIC" className="rounded-lg border border-white/10 bg-white p-1" />
                    ) : null}
                  </div>
                  <Button type="button" className="min-h-14 w-full text-lg" disabled={busy} onClick={() => void gateIn()}>
                    Registrar entrada
                  </Button>
                </CardContent>
              </Card>
          ) : (
            <Card className="border-white/10 bg-[#0c0f14]">
              <CardHeader>
                <CardTitle className="text-white">Gate-OUT</CardTitle>
                <CardDescription>Checklist e POST /solicitacoes/saida</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-3 text-slate-300">
                  <input type="checkbox" required className="h-5 w-5 accent-[var(--accent)]" id="ck1" />
                  Conferir lacres / documentação
                </label>
                <label className="flex items-center gap-3 text-slate-300">
                  <input type="checkbox" required className="h-5 w-5 accent-[var(--accent)]" id="ck2" />
                  Liberar saída física apenas após registro no sistema
                </label>
                <Button type="button" className="min-h-14 w-full text-lg" disabled={busy} onClick={() => void gateOut()}>
                  Confirmar saída
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </main>
  );
}
