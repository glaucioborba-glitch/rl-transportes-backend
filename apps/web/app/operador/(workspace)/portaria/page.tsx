"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OperationalTimeline } from "@/components/operador/operational-timeline";
import { OCRCaptureButton } from "@/components/operador/ocr-capture-button";
import { PhotoUploader, type PhotoEntry } from "@/components/operador/photo-uploader";
import { PortariaChecklist } from "@/components/operador/portaria-checklist";
import type { OcrCheckState } from "@/components/operador/operador-status-badge";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";

type TipoOpUi = "BAIXA" | "COLETA" | "TRANSBORDO";

const MAP_TIPO: Record<TipoOpUi, string> = {
  BAIXA: "IMPORT",
  COLETA: "EXPORT",
  TRANSBORDO: "GATE_IN",
};

function normPlaca(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

type SolRow = { id: string; protocolo: string; status: string };
type ClienteRow = { id: string; nome: string };

export default function PortariaPage() {
  const [pendentes, setPendentes] = useState<SolRow[]>([]);
  const [solicitacaoId, setSolicitacaoId] = useState("");
  const [iso, setIso] = useState("");
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta, setPlacaCarreta] = useState("");
  const [cpfMotorista, setCpfMotorista] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteQ, setClienteQ] = useState("");
  const [clientesHit, setClientesHit] = useState<ClienteRow[]>([]);
  const [tipoOp, setTipoOp] = useState<TipoOpUi>("BAIXA");
  const [conferenciaOk, setConferenciaOk] = useState(false);
  const [avariaDesc, setAvariaDesc] = useState("");
  const [avariaFotos, setAvariaFotos] = useState<PhotoEntry[]>([]);
  const [lacreDesc, setLacreDesc] = useState("");
  const [lacreFotos, setLacreFotos] = useState<PhotoEntry[]>([]);
  const [fotosCaminhao, setFotosCaminhao] = useState<PhotoEntry[]>([]);
  const [fotosContainer, setFotosContainer] = useState<PhotoEntry[]>([]);
  const [ocrEstado, setOcrEstado] = useState<OcrCheckState>("pendente");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPendentes = useCallback(async () => {
    try {
      const r = await staffJson<{ items: SolRow[] }>("/solicitacoes?status=PENDENTE&limit=50&page=1");
      setPendentes(r.items ?? []);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao listar PENDENTE");
    }
  }, []);

  useEffect(() => {
    void loadPendentes();
  }, [loadPendentes]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        const q = clienteQ.trim();
        if (q.length < 2) {
          setClientesHit([]);
          return;
        }
        try {
          const r = await staffJson<{ data: ClienteRow[] }>(
            `/clientes?search=${encodeURIComponent(q)}&limit=15&page=1`,
          );
          setClientesHit(r.data ?? []);
        } catch {
          setClientesHit([]);
        }
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [clienteQ]);

  useEffect(() => {
    if (!solicitacaoId) {
      setPreview(null);
      return;
    }
    let cancel = false;
    void (async () => {
      try {
        const s = await staffJson<Record<string, unknown>>(`/solicitacoes/${solicitacaoId}`);
        if (!cancel) setPreview(s);
      } catch {
        if (!cancel) setPreview(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [solicitacaoId]);

  const timelineFlags = useMemo(() => {
    const p = preview as { portaria?: unknown; gate?: unknown; patio?: unknown; saida?: unknown } | null;
    return {
      portariaDone: !!p?.portaria,
      gateDone: !!p?.gate,
      patioDone: !!p?.patio,
      saidaDone: !!p?.saida,
    };
  }, [preview]);

  function playBeep() {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.start();
      setTimeout(() => o.stop(), 120);
    } catch {
      /* opcional */
    }
  }

  async function criarSolicitacao() {
    const pIso = iso.replace(/\s/g, "").toUpperCase();
    if (!clienteId || !pIso) {
      toast.error("Cliente e ISO são obrigatórios para nova OS.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await staffJson<{ id: string }>(`/solicitacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          unidades: [{ numeroIso: pIso, tipo: MAP_TIPO[tipoOp] }],
        }),
      });
      setSolicitacaoId(created.id);
      toast.success("Solicitação criada");
      void loadPendentes();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao criar");
    } finally {
      setSubmitting(false);
    }
  }

  async function enviarPortaria() {
    const placa = normPlaca(placaCavalo);
    if (placa.length < 7) {
      toast.error("Placa cavalo inválida (Mercosul).");
      return;
    }
    if (!conferenciaOk) {
      toast.error("Marque a conferência visual.");
      return;
    }
    if (!solicitacaoId) {
      toast.error("Selecione ou crie uma solicitação.");
      return;
    }
    setSubmitting(true);
    try {
      await staffJson(`/solicitacoes/portaria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitacaoId, placa }),
      });
      toast.success("Portaria registrada no sistema");
      playBeep();
      void loadPendentes();
      const s = await staffJson<Record<string, unknown>>(`/solicitacoes/${solicitacaoId}`);
      setPreview(s);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha portaria");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-white">Operador · Portaria</h1>
        <p className="text-sm text-slate-500">
          checklist, OCR e fotos na interface. Envio oficial: POST /solicitacoes/portaria (solicitacaoId +
          placa). Evidências extras permanecem no aparelho até o backend aceitar anexos nesta rota.
        </p>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="py-3">
          <CardTitle className="text-base text-amber-100">Campos locais (não enviados nesta API)</CardTitle>
          <CardDescription className="text-amber-100/80">
            Carreta, CPF motorista e álbum de fotos fazem parte do procedimento no tablet; apenas a placa do
            cavalo segue para o servidor neste POST.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0c0f14]">
          <CardHeader>
            <CardTitle className="text-white">Solicitação</CardTitle>
            <CardDescription>PENDENTE existente ou criação rápida</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-xs text-slate-500">Vincular a PENDENTE</label>
            <select
              className="flex min-h-12 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-white"
              value={solicitacaoId}
              onChange={(e) => setSolicitacaoId(e.target.value)}
            >
              <option value="">— selecionar —</option>
              {pendentes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.protocolo}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-600">GET /solicitacoes?status=PENDENTE</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0c0f14]">
          <CardHeader>
            <CardTitle className="text-white">Nova solicitação</CardTitle>
            <CardDescription>POST /solicitacoes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-slate-500">Cliente (busca)</label>
              <Input
                className="min-h-12 border-white/15 bg-black/40 text-white"
                placeholder="Nome, e-mail ou documento"
                value={clienteQ}
                onChange={(e) => setClienteQ(e.target.value)}
              />
              {clientesHit.length ? (
                <ul className="mt-1 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/50 text-sm">
                  {clientesHit.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-white/10"
                        onClick={() => {
                          setClienteId(c.id);
                          setClienteQ(c.nome);
                          setClientesHit([]);
                        }}
                      >
                        {c.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {clienteId ? <p className="mt-1 text-xs text-emerald-400">Cliente vinculado</p> : null}
            </div>
            <div>
              <label className="text-xs text-slate-500">Tipo operação (mapeado → enum)</label>
              <select
                className="flex min-h-12 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-white"
                value={tipoOp}
                onChange={(e) => setTipoOp(e.target.value as TipoOpUi)}
              >
                <option value="BAIXA">BAIXA → IMPORT</option>
                <option value="COLETA">COLETA → EXPORT</option>
                <option value="TRANSBORDO">TRANSBORDO → GATE_IN</option>
              </select>
            </div>
            <Input
              className="min-h-12 border-white/15 bg-black/40 font-mono text-white"
              placeholder="ISO 6346 (ex: MSCU1234567)"
              value={iso}
              onChange={(e) => setIso(e.target.value)}
            />
            <Button type="button" className="min-h-12 w-full" disabled={submitting} onClick={() => void criarSolicitacao()}>
              Criar e vincular
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#0c0f14]">
        <CardHeader>
          <CardTitle className="text-white">Captura</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs text-slate-500">Número ISO</label>
            <Input
              className="min-h-12 border-white/15 bg-black/40 font-mono text-white"
              value={iso}
              onChange={(e) => setIso(e.target.value)}
            />
            <OCRCaptureButton
              label="OCR ISO / placa"
              onResult={(r) => {
                if (r.numeroIso && r.numeroIsoValido6346) setIso(r.numeroIso);
                if (r.placa && r.placaValidaMercosul) setPlacaCavalo(r.placa);
                setOcrEstado(r.placaValidaMercosul || r.numeroIsoValido6346 ? "sucesso" : "falhou");
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-500">Placa cavalo (enviada)</label>
            <Input
              className="min-h-12 border-white/15 bg-black/40 font-mono text-white"
              value={placaCavalo}
              onChange={(e) => setPlacaCavalo(e.target.value)}
            />
            <label className="text-xs text-slate-500">Placa carreta (local)</label>
            <Input
              className="min-h-12 border-white/15 bg-black/40 font-mono text-white"
              value={placaCarreta}
              onChange={(e) => setPlacaCarreta(e.target.value)}
            />
            <label className="text-xs text-slate-500">CPF motorista (local)</label>
            <Input
              className="min-h-12 border-white/15 bg-black/40 text-white"
              value={cpfMotorista}
              onChange={(e) => setCpfMotorista(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <PhotoUploader label="Fotos caminhão (áudio‑visual local)" photos={fotosCaminhao} onChange={setFotosCaminhao} />
      <PhotoUploader label="Fotos contêiner (local)" photos={fotosContainer} onChange={setFotosContainer} />

      <PortariaChecklist
        conferenciaOk={conferenciaOk}
        setConferenciaOk={setConferenciaOk}
        avariaDescricao={avariaDesc}
        setAvariaDescricao={setAvariaDesc}
        avariaFotos={avariaFotos}
        setAvariaFotos={setAvariaFotos}
        lacreDescricao={lacreDesc}
        setLacreDescricao={setLacreDesc}
        lacreFotos={lacreFotos}
        setLacreFotos={setLacreFotos}
        ocrEstado={ocrEstado}
      />

      <Card className="border-white/10 bg-[#0c0f14]">
        <CardHeader>
          <CardTitle className="text-white">Linha do tempo (preview)</CardTitle>
          <CardDescription>GET /solicitacoes/:id</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OperationalTimeline active="portaria" {...timelineFlags} />
          {preview ? (
            <pre className="max-h-48 overflow-auto rounded-lg bg-black/50 p-3 text-[10px] text-slate-400">
              {JSON.stringify(
                {
                  protocolo: preview.protocolo,
                  status: preview.status,
                  portaria: !!preview.portaria,
                  gate: !!preview.gate,
                  patio: !!preview.patio,
                  saida: !!preview.saida,
                },
                null,
                2,
              )}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">Selecione uma solicitação para pré-visualizar.</p>
          )}
        </CardContent>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#080a0d]/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-3">
          <Button
            type="button"
            className="min-h-14 flex-1 text-lg"
            disabled={submitting}
            onClick={() => void enviarPortaria()}
          >
            Registrar portaria
          </Button>
        </div>
      </div>
    </main>
  );
}
