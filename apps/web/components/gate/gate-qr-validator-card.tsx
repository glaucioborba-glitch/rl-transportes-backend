"use client";

import { useState } from "react";
import { AlertOctagon, QrCode, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, staffGateValidarQr } from "@/lib/api/staff-client";

export function GateQrValidatorCard() {
  const [protocolo, setProtocolo] = useState("");
  const [container, setContainer] = useState("");
  const [versao, setVersao] = useState("");
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const [ok, setOk] = useState<Record<string, unknown> | null>(null);

  async function onValidar() {
    if (!protocolo.trim()) return;
    setBusy(true);
    setDenied(null);
    setOk(null);
    try {
      const r = await staffGateValidarQr({
        protocolo: protocolo.trim(),
        container: container.trim() || undefined,
        versao: versao.trim() ? Number(versao) : undefined,
      });
      if (!r.valido) {
        setDenied(r.motivo ?? "Credencial inválida");
        return;
      }
      setOk(r.solicitacao ?? {});
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha na validação";
      setDenied(msg);
    } finally {
      setBusy(false);
    }
  }

  const blocked = Boolean(denied);

  return (
    <Card
      className={
        blocked
          ? "border-rose-600 bg-rose-950/80 ring-2 ring-rose-500"
          : "border-cyan-500/30 bg-[#0a1020]/90"
      }
    >
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 text-lg ${blocked ? "text-rose-50" : "text-white"}`}>
          {blocked ? <AlertOctagon className="h-6 w-6 text-rose-300" /> : <QrCode className="h-6 w-6 text-cyan-400" />}
          Validar QR — Gate
        </CardTitle>
        <CardDescription className={blocked ? "text-rose-100/90" : "text-zinc-500"}>
          Hard stop: bloqueios financeiros/fiscais impedem leitura antes de qualquer check-in/out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {blocked ? (
          <div className="rounded-xl border-2 border-rose-400 bg-rose-900/60 p-4 text-center">
            <p className="text-lg font-bold uppercase tracking-wide text-rose-50">Acesso negado</p>
            <p className="mt-2 text-sm font-medium text-rose-100">{denied}</p>
          </div>
        ) : null}

        {!blocked && ok ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-sm text-emerald-100">
            <p className="font-semibold">Credencial válida</p>
            <p className="mt-1 font-mono text-xs">
              {String(ok.protocolo ?? "—")} · {String(ok.containerISO ?? "—")}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <Label className={blocked ? "text-rose-100" : "text-zinc-400"}>Protocolo</Label>
            <Input
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value)}
              className="min-h-12 border-zinc-600 bg-black/40 font-mono text-white"
              placeholder="RL-2026-…"
            />
          </div>
          <div className="space-y-1">
            <Label className={blocked ? "text-rose-100" : "text-zinc-400"}>Versão</Label>
            <Input
              value={versao}
              onChange={(e) => setVersao(e.target.value.replace(/\D/g, ""))}
              className="min-h-12 border-zinc-600 bg-black/40 font-mono text-white"
              placeholder="1"
            />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label className={blocked ? "text-rose-100" : "text-zinc-400"}>Container ISO</Label>
            <Input
              value={container}
              onChange={(e) => setContainer(e.target.value.toUpperCase())}
              className="min-h-12 border-zinc-600 bg-black/40 font-mono text-white"
              placeholder="MSKU1234567"
            />
          </div>
        </div>

        <Button
          type="button"
          className={
            blocked
              ? "min-h-14 w-full bg-rose-600 text-lg font-bold text-white hover:bg-rose-500"
              : "min-h-14 w-full bg-cyan-500 text-lg font-bold text-black hover:bg-cyan-400"
          }
          disabled={busy || !protocolo.trim()}
          onClick={() => void onValidar()}
        >
          <ScanLine className="mr-2 h-5 w-5" />
          {busy ? "Validando…" : blocked ? "Tentar novamente" : "Validar QR"}
        </Button>
      </CardContent>
    </Card>
  );
}
