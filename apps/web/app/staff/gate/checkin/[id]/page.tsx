"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Container, QrCode, Shield, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  staffGateCheckIn,
  staffGateEnviarPatio,
  staffGateOcrPlacaMock,
  staffGatePatioUnidades,
  staffGatePreCheckIn,
  staffPatioInventario,
  type StaffPatioInventario,
} from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { OperationPageHeader } from "@/components/shared/operation-identity";

type PatioUnidadeRow = {
  id: string;
  unidadeIso: string;
  status: string;
  posicaoAtual?: { codigoBaia: string } | null;
};

export default function StaffGateCheckInPage() {
  const { id: solicitacaoId } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const hashQr = sp.get("hash") ?? "";

  const [ctx, setCtx] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);

  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta01, setPlacaCarreta01] = useState("");
  const [placaCarreta02, setPlacaCarreta02] = useState("");
  const [motoristaNome, setMotoristaNome] = useState("");
  const [motoristaCpf, setMotoristaCpf] = useState("");
  const [pdfHash, setPdfHash] = useState(hashQr);
  const [divTipo, setDivTipo] = useState("PLACA_DIVERGENTE");
  const [divAntes, setDivAntes] = useState("");
  const [divDepois, setDivDepois] = useState("");
  const [divManual, setDivManual] = useState<{ tipo: string; antes?: string; depois?: string }[]>([]);

  const [patioOpen, setPatioOpen] = useState(false);
  const [gateInId, setGateInId] = useState<string | null>(null);
  const [patioUnidades, setPatioUnidades] = useState<PatioUnidadeRow[]>([]);
  const [patioInv, setPatioInv] = useState<StaffPatioInventario | null>(null);
  const [baiaPorUnidade, setBaiaPorUnidade] = useState<Record<string, string>>({});
  const [qrIso, setQrIso] = useState("");
  const [patioBusy, setPatioBusy] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPdfHash(hashQr);
  }, [hashQr]);

  const load = useCallback(
    async (hash?: string) => {
      if (!solicitacaoId) return;
      setLoading(true);
      try {
        const c = await staffGatePreCheckIn(solicitacaoId, hash);
        setCtx(c);
        const ts = c.transporte as Record<string, unknown> | undefined;
        if (ts) {
          setPlacaCavalo(String(ts.placaCavalo ?? ""));
          setPlacaCarreta01(String(ts.placaCarreta01 ?? ""));
          setPlacaCarreta02(ts.placaCarreta02 != null ? String(ts.placaCarreta02) : "");
          setMotoristaNome(String(ts.nomeMotorista ?? ""));
          setMotoristaCpf(String(ts.cpfMotorista ?? ""));
        }
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Falha ao carregar contexto");
      } finally {
        setLoading(false);
      }
    },
    [solicitacaoId],
  );

  useEffect(() => {
    void load(hashQr.trim() || undefined);
  }, [solicitacaoId, hashQr, load]);

  const auth = ctx?.autenticidade as Record<string, unknown> | undefined;
  const pdfOk = auth?.valido === true;
  const autoDiv = (ctx?.divergenciasAutomaticas as unknown[]) ?? [];
  const containers = (ctx?.containers as Record<string, unknown>[]) ?? [];
  const agendamento = ctx?.agendamento as Record<string, unknown> | null | undefined;
  const anexos = (ctx?.anexos as Record<string, unknown>[]) ?? [];
  const transporte = ctx?.transporte as Record<string, unknown> | undefined;
  const protocolo = ctx?.protocolo as string | undefined;
  const containerIsos = (containers as Array<{ unidade?: string; ordem?: number }>)
    .map((c) => String(c.unidade ?? ""))
    .filter(Boolean);

  async function onOcr(f: File) {
    try {
      const r = await staffGateOcrPlacaMock(f);
      const p = r.placa as string | null;
      if (p) {
        setPlacaCavalo(p);
        toast.success(`OCR (mock): ${p}`);
      } else toast.info("OCR sem placa válida");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "OCR falhou");
    }
  }

  async function loadPatioModal(ginId: string) {
    setPatioBusy(true);
    try {
      const [unidades, inv] = await Promise.all([
        staffGatePatioUnidades(ginId) as Promise<PatioUnidadeRow[]>,
        staffPatioInventario(),
      ]);
      setPatioUnidades(unidades);
      setPatioInv(inv);
      const baiasLivres = inv.baias.filter((b) => b.ocupacao < b.capacidade).map((b) => b.codigoBaia);
      const defaults: Record<string, string> = {};
      for (const u of unidades) {
        defaults[u.id] = u.posicaoAtual?.codigoBaia ?? baiasLivres[0] ?? "";
      }
      setBaiaPorUnidade(defaults);
      setPatioOpen(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar pátio");
    } finally {
      setPatioBusy(false);
    }
  }

  function onQrIsoScan(raw: string) {
    const iso = raw.trim().toUpperCase();
    setQrIso(iso);
    const hit = patioUnidades.find((u) => u.unidadeIso.toUpperCase().includes(iso) || iso.includes(u.unidadeIso.toUpperCase()));
    if (hit) {
      toast.success(`Container localizado: ${hit.unidadeIso}`);
      document.getElementById(`baia-${hit.id}`)?.focus();
    } else if (iso.length >= 4) {
      toast.info("ISO não encontrado neste check-in");
    }
  }

  async function onEnviarPatio() {
    if (!gateInId) return;
    const posicoes = patioUnidades
      .filter((u) => u.status === "SEPARADO" || !u.posicaoAtual)
      .map((u) => ({ unidadeId: u.id, codigoBaia: (baiaPorUnidade[u.id] ?? "").trim() }))
      .filter((p) => p.codigoBaia);
    if (!posicoes.length) {
      toast.error("Selecione ao menos uma baia destino");
      return;
    }
    setPatioBusy(true);
    try {
      const r = await staffGateEnviarPatio(gateInId, posicoes);
      toast.success(`${r.posicionadas} unidade(s) posicionada(s) no pátio`);
      setPatioOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao enviar para pátio");
    } finally {
      setPatioBusy(false);
    }
  }

  async function onSubmit() {
    if (!solicitacaoId) return;
    if (!fotos.length) {
      toast.error("Selecione fotos de entrada");
      return;
    }
    setBusy(true);
    try {
      const res = await staffGateCheckIn(
        solicitacaoId,
        {
          placaCavalo,
          placaCarreta01,
          placaCarreta02: placaCarreta02.trim() || undefined,
          motoristaNome,
          motoristaCpf: motoristaCpf.replace(/\D/g, ""),
          pdfHash: pdfHash.trim() || undefined,
          divergenciasOperador: divManual.length ? divManual : undefined,
        },
        fotos,
      );
      const gin = String(res.id ?? "");
      toast.success("Check-in registrado");
      if (gin) {
        setGateInId(gin);
        await loadPatioModal(gin);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha no check-in");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !ctx) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <OperationPageHeader
        isos={containerIsos}
        protocolo={protocolo}
        eyebrow={
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-400/80">Gate check-in</p>
        }
        actions={
          <Button variant="outline" className="border-zinc-600" asChild>
            <Link href="/staff/gate">Voltar à fila</Link>
          </Button>
        }
      />

      <Card className="border-white/10 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Shield className="h-5 w-5 text-emerald-400" />
            Autenticidade (PDF)
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Informe o hash do QRCode ou valide antes de confirmar. Operação exige hash válido quando informado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-zinc-400">Hash SHA-256 (64 chars)</Label>
              <Input
                value={pdfHash}
                onChange={(e) => setPdfHash(e.target.value)}
                className="border-zinc-600 bg-black/40 font-mono text-sm text-white"
                placeholder="Cole o hash do rodapé do PDF / query ?hash="
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void load(pdfHash.trim() || undefined)}>
              Revalidar
            </Button>
          </div>
          {auth?.valido === true ? (
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> PDF autêntico — sem divergências de integridade.
            </p>
          ) : auth?.valido === false ? (
            <div className="rounded-md border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-100">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Hash divergente ou snapshot expirado
              </p>
              <p className="mt-1 text-xs text-rose-200/80">Gere novo PDF ou confira alterações na solicitação.</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Informe o hash para validar contra o Security Engine.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="text-lg text-white">Solicitação — transporte e containers</CardTitle>
          <CardDescription className="text-zinc-500">
            {transporte?.tipoCaminhao === "RODOTREM" ? "Rodotrem" : "LS"} · conferência física no gate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-300">
          {containers.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {containers.map((c, i) => (
                <li key={i} className="rounded border border-white/10 bg-black/30 p-3">
                  <p className="font-mono text-emerald-100/90">#{String(c.ordem)} {String(c.unidade ?? "—")}</p>
                  <p className="text-xs text-zinc-500">
                    {String(c.booking ?? "")} · {String(c.status ?? c.status_container ?? "")}
                    {c.lacre ? ` · lacre ${String(c.lacre)}` : ""}
                    {c.refrigerado ? ` · reefer ${String(c.setPoint ?? c.set_point ?? "—")}°C` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-500">Sem containers na solicitação.</p>
          )}
          {agendamento ? (
            <p className="text-xs text-zinc-400">
              Agendamento: {String(agendamento.dataRef ?? agendamento.data_ref ?? "—")} · turno{" "}
              {String(agendamento.turno ?? "—")}
            </p>
          ) : null}
          {anexos.length ? (
            <p className="text-xs text-zinc-500">{anexos.length} anexo(s) no dossiê corporativo.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-rose-500/25 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="text-lg text-white">Divergências automáticas</CardTitle>
        </CardHeader>
        <CardContent>
          {autoDiv.length ? (
            <ul className="space-y-2 text-sm text-rose-100">
              {autoDiv.map((d, i) => (
                <li key={i} className="rounded border border-rose-500/30 bg-rose-950/30 px-3 py-2">
                  {JSON.stringify(d)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-emerald-200/80">Nenhuma divergência automática — conferência verde.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="text-lg text-white">Divergências do operador</CardTitle>
          <CardDescription className="text-zinc-500">Lacre, container, processo — registradas no JSON do check-in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-zinc-400">Tipo</Label>
              <select
                value={divTipo}
                onChange={(e) => setDivTipo(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-600 bg-black/40 px-2 py-2 text-sm text-white"
              >
                <option value="PLACA_DIVERGENTE">Placa divergente</option>
                <option value="LACRE_DIVERGENTE">Lacre divergente</option>
                <option value="CONTAINER_TROCADO">Container trocado</option>
                <option value="SETPOINT_INCONSISTENTE">Set-point</option>
                <option value="PROCESSO_INCONSISTENTE">Processo</option>
                <option value="OUTRA">Outra</option>
              </select>
            </div>
            <div>
              <Label className="text-zinc-400">Antes</Label>
              <Input value={divAntes} onChange={(e) => setDivAntes(e.target.value)} className="border-zinc-600 bg-black/40 text-white" />
            </div>
            <div>
              <Label className="text-zinc-400">Depois</Label>
              <Input value={divDepois} onChange={(e) => setDivDepois(e.target.value)} className="border-zinc-600 bg-black/40 text-white" />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-amber-600/50 text-amber-100"
            onClick={() => {
              setDivManual((prev) => [
                ...prev,
                { tipo: divTipo, antes: divAntes.trim() || undefined, depois: divDepois.trim() || undefined },
              ]);
              setDivAntes("");
              setDivDepois("");
            }}
          >
            Adicionar divergência
          </Button>
          {divManual.length ? (
            <ul className="space-y-1 text-xs text-amber-100">
              {divManual.map((d, i) => (
                <li key={i} className="rounded border border-amber-500/30 px-2 py-1">
                  {d.tipo}: {d.antes ?? "—"} → {d.depois ?? "—"}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="text-lg text-white">Dados no gate</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-zinc-400">Placa cavalo</Label>
            <Input
              value={placaCavalo}
              onChange={(e) => setPlacaCavalo(e.target.value.toUpperCase())}
              className="border-zinc-600 bg-black/40 font-mono text-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-zinc-400">Carreta 01</Label>
            <Input
              value={placaCarreta01}
              onChange={(e) => setPlacaCarreta01(e.target.value.toUpperCase())}
              className="border-zinc-600 bg-black/40 font-mono text-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-zinc-400">Carreta 02</Label>
            <Input
              value={placaCarreta02}
              onChange={(e) => setPlacaCarreta02(e.target.value.toUpperCase())}
              className="border-zinc-600 bg-black/40 font-mono text-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-zinc-400">Motorista</Label>
            <Input
              value={motoristaNome}
              onChange={(e) => setMotoristaNome(e.target.value)}
              className="border-zinc-600 bg-black/40 text-white"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-zinc-400">CPF motorista (11 dígitos)</Label>
            <Input
              value={motoristaCpf}
              onChange={(e) => setMotoristaCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
              className="border-zinc-600 bg-black/40 font-mono text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Upload className="h-5 w-5" />
            Fotos de entrada
          </CardTitle>
          <CardDescription className="text-zinc-500">Múltiplas imagens — carreta, containers, lacres.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept="image/*"
            multiple
            className="text-zinc-300"
            onChange={(e) => setFotos(Array.from(e.target.files ?? []))}
          />
          <div className="flex flex-wrap gap-2">
            {fotos.slice(0, 6).map((f) => (
              <span key={f.name + f.size} className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-400">
                {f.name}
              </span>
            ))}
          </div>
          <div>
            <Label className="text-xs text-zinc-500">OCR mock (uma imagem)</Label>
            <Input
              type="file"
              accept="image/*"
              className="mt-1 text-zinc-300"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onOcr(f);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="bg-emerald-600 text-white hover:bg-emerald-500"
          disabled={busy || (pdfHash.trim() !== "" && !pdfOk)}
          onClick={() => void onSubmit()}
        >
          {busy ? "…" : "Confirmar check-in"}
        </Button>
        {pdfHash.trim() && !pdfOk ? (
          <p className="text-xs text-rose-300">Corrija a autenticidade do PDF antes de confirmar.</p>
        ) : null}
      </div>

      <Dialog open={patioOpen} onOpenChange={setPatioOpen}>
        <DialogContent className="max-w-xl border-emerald-500/20 bg-[#0b101c]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Container className="h-5 w-5 text-emerald-400" />
              Enviar para Pátio
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Posicione cada container em uma baia inicial. Use o leitor QR / ISO para localizar a unidade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-2 text-zinc-400">
                <QrCode className="h-4 w-4" /> Scanner QR / ISO
              </Label>
              <Input
                ref={qrRef}
                value={qrIso}
                onChange={(e) => onQrIsoScan(e.target.value)}
                placeholder="Cole ou escaneie o código ISO do container"
                className="border-zinc-600 bg-black/40 font-mono text-white"
                autoComplete="off"
              />
            </div>

            {patioBusy && !patioUnidades.length ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {patioUnidades.map((u) => (
                  <li key={u.id} className="rounded border border-white/10 bg-black/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm text-emerald-100">{u.unidadeIso}</p>
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">{u.status}</p>
                      </div>
                      <select
                        id={`baia-${u.id}`}
                        value={baiaPorUnidade[u.id] ?? ""}
                        onChange={(e) => setBaiaPorUnidade((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        className="rounded-md border border-zinc-600 bg-black/40 px-2 py-1.5 text-sm text-white"
                        disabled={u.status === "ESTOCADO" && !!u.posicaoAtual}
                      >
                        <option value="">— baia —</option>
                        {(patioInv?.baias ?? []).map((b) => (
                          <option key={b.id} value={b.codigoBaia} disabled={b.ocupacao >= b.capacidade}>
                            {b.codigoBaia} ({b.ocupacao}/{b.capacidade})
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="border-zinc-600" asChild>
              <Link href="/staff/patio">Abrir dashboard pátio</Link>
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              disabled={patioBusy}
              onClick={() => void onEnviarPatio()}
            >
              {patioBusy ? "…" : "Confirmar posicionamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
