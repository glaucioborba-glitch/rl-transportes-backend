"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/motorista/mobile-header";
import { BigInput } from "@/components/motorista/big-input";
import { MobileButton } from "@/components/motorista/mobile-button";
import { OcrCaptureMobile } from "@/components/motorista/ocr-capture-mobile";
import { ApiError, motoristaFetchSolicitacao, motoristaJson } from "@/lib/api/motorista-client";
import { useMotoristaAuthStore } from "@/stores/motorista-auth-store";
import { canCreateSolicitacao, canListClientes, canPortaria } from "@/lib/motorista/permissions";
import { getOrCreatePin, qrPayloadFromTrip } from "@/lib/motorista/pin-storage";
import { vibrateShort } from "@/lib/motorista/haptics";
import { toast } from "@/lib/toast";

const ISO_RE = /^[A-Z]{4}[0-9]{6}[0-9]$/;

function normalizePlaca(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function tipoFromOp(op: string): "IMPORT" | "EXPORT" | "GATE_IN" {
  if (op === "COLETA") return "IMPORT";
  if (op === "TRANSBORDO") return "GATE_IN";
  return "EXPORT";
}

export default function MotoristaCheckinPage() {
  const router = useRouter();
  const user = useMotoristaAuthStore((s) => s.user);
  const [cpf, setCpf] = useState("");
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta, setPlacaCarreta] = useState("");
  const [iso, setIso] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [opTipo, setOpTipo] = useState<"BAIXA" | "COLETA" | "TRANSBORDO">("BAIXA");
  const [protocoloBusca, setProtocoloBusca] = useState("");
  const [busy, setBusy] = useState(false);
  const [modoVincular, setModoVincular] = useState(false);

  const createOk = canCreateSolicitacao(user);
  const portOk = canPortaria(user);
  const listCxOk = canListClientes(user);
  const clienteJwt = user?.clienteId ?? "";

  useEffect(() => {
    if (clienteJwt) setClienteId(clienteJwt);
  }, [clienteJwt]);

  useEffect(() => {
    if (!listCxOk || user?.role === "CLIENTE") return;
    void (async () => {
      try {
        const r = await motoristaJson<{ data: { id: string; nome: string }[] }>("/clientes?limit=40&page=1");
        setClientes(r.data ?? []);
      } catch {
        /* sem permissão ou rede */
      }
    })();
  }, [listCxOk, user?.role]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const isoNorm = iso.replace(/\s/g, "").toUpperCase();
      if (!ISO_RE.test(isoNorm)) {
        toast.error("ISO inválido (formato 6346)");
        return;
      }
      const placa = normalizePlaca(placaCavalo);
      if (placa.length < 7) {
        toast.error("Placa cavalo inválida (mín. 7 caracteres)");
        return;
      }

      let solicitacaoId: string;
      let protocolo: string;

      if (portOk && protocoloBusca.trim() && (modoVincular || !createOk)) {
        const list = await motoristaJson<{ items: { id: string; protocolo: string }[] }>(
          `/solicitacoes?protocolo=${encodeURIComponent(protocoloBusca.trim())}&limit=5&page=1`,
        );
        const first = list.items?.[0];
        if (!first) {
          toast.error("Protocolo não encontrado");
          return;
        }
        solicitacaoId = first.id;
        protocolo = first.protocolo;
        await motoristaJson("/solicitacoes/portaria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solicitacaoId, placa }),
        });
      } else if (createOk && portOk && clienteId && !modoVincular) {
        const created = await motoristaJson<{ id: string; protocolo: string }>("/solicitacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteId,
            unidades: [{ numeroIso: isoNorm, tipo: tipoFromOp(opTipo) }],
          }),
        });
        solicitacaoId = created.id;
        protocolo = created.protocolo;
        await motoristaJson("/solicitacoes/portaria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solicitacaoId, placa }),
        });
      } else if (user?.role === "CLIENTE" || (!createOk && !portOk)) {
        const q = protocoloBusca.trim();
        if (!q) {
          toast.error("Informe o protocolo da operação");
          return;
        }
        const list = await motoristaJson<{ items: { id: string; protocolo: string }[] }>(
          `/cliente/portal/solicitacoes?protocolo=${encodeURIComponent(q)}&limit=10&page=1`,
        );
        const pick = list.items?.[0];
        if (!pick) {
          toast.error("Operação não encontrada para este protocolo");
          return;
        }
        solicitacaoId = pick.id;
        protocolo = pick.protocolo;
      } else {
        toast.error("Informe cliente (nova viagem) ou ative “vincular protocolo”.");
        return;
      }

      let isosStored = [isoNorm];
      try {
        const detail = await motoristaFetchSolicitacao(solicitacaoId);
        const unidades = (detail.unidades as { numeroIso?: string }[]) ?? [];
        const fromBack = unidades.map((u) => u.numeroIso).filter(Boolean) as string[];
        if (fromBack.length) isosStored = fromBack;
      } catch {
        /* mantém ISO do formulário */
      }

      const pin = getOrCreatePin(solicitacaoId);
      const qr = qrPayloadFromTrip({ solicitacaoId, protocolo, pin });
      sessionStorage.setItem(
        "rl_motorista_last_trip",
        JSON.stringify({
          solicitacaoId,
          protocolo,
          pin,
          isos: isosStored,
          cpf,
          placaCarreta: placaCarreta ? normalizePlaca(placaCarreta) : "",
          qr,
        }),
      );
      vibrateShort();
      toast.success("Senha eletrônica gerada");
      router.push(`/motorista/senha?sid=${encodeURIComponent(solicitacaoId)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha no check-in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <MobileHeader title="Check-in digital" />
      <main className="mx-auto max-w-lg space-y-4 px-3 pt-4">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90">
          Dados como CPF, carreta e observações ficam no aparelho para leitura rápida; o backend recebe apenas o
          contrato real de cada rota (criação, portaria, etc.).
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <BigInput
            label="CPF do motorista"
            inputMode="numeric"
            autoComplete="off"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
          />

          <BigInput
            label="Placa cavalo"
            value={placaCavalo}
            onChange={(e) => setPlacaCavalo(e.target.value.toUpperCase())}
            placeholder="Mercosul"
          />
          <OcrCaptureMobile
            label="Ler placa/camera (OCR)"
            disabled={busy}
            onResult={(r) => {
              if (r.placa) setPlacaCavalo(String(r.placa).toUpperCase());
              if (r.numeroIso) setIso(String(r.numeroIso).toUpperCase().replace(/\s/g, ""));
            }}
          />

          <BigInput
            label="Placa carreta (local)"
            value={placaCarreta}
            onChange={(e) => setPlacaCarreta(e.target.value.toUpperCase())}
            placeholder="Opcional"
          />

          <BigInput
            label="Número ISO do contêiner"
            value={iso}
            onChange={(e) => setIso(e.target.value.toUpperCase())}
            placeholder="AAAA1234567"
            className="font-mono"
          />

          {createOk && portOk ? (
            <>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/15 bg-black/30 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--accent)]"
                  checked={modoVincular}
                  onChange={(e) => setModoVincular(e.target.checked)}
                />
                <span className="text-sm text-slate-200">Já tenho protocolo (vincular + portaria)</span>
              </label>
              {modoVincular ? (
                <BigInput
                  label="Protocolo existente"
                  value={protocoloBusca}
                  onChange={(e) => setProtocoloBusca(e.target.value)}
                  className="font-mono"
                />
              ) : null}

              {!modoVincular && user?.role !== "CLIENTE" ? (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">Cliente (obrigatório)</label>
                  {clientes.length ? (
                    <select
                      className="h-14 w-full rounded-2xl border-2 border-white/15 bg-black/40 px-4 text-lg text-white"
                      value={clienteId}
                      onChange={(e) => setClienteId(e.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <BigInput
                      label="ID do cliente (UUID)"
                      value={clienteId}
                      onChange={(e) => setClienteId(e.target.value)}
                      className="font-mono text-base"
                    />
                  )}
                </div>
              ) : null}

              {!modoVincular ? (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">Tipo de operação</label>
                  <select
                    className="h-14 w-full rounded-2xl border-2 border-white/15 bg-black/40 px-4 text-lg text-white"
                    value={opTipo}
                    onChange={(e) => setOpTipo(e.target.value as typeof opTipo)}
                  >
                    <option value="BAIXA">BAIXA</option>
                    <option value="COLETA">COLETA</option>
                    <option value="TRANSBORDO">TRANSBORDO</option>
                  </select>
                </div>
              ) : null}
            </>
          ) : null}

          {(user?.role === "CLIENTE" || (!createOk && !portOk)) && (
            <BigInput
              label="Protocolo da operação"
              value={protocoloBusca}
              onChange={(e) => setProtocoloBusca(e.target.value)}
              placeholder="RL-2026-…"
              className="font-mono"
            />
          )}

          {portOk && !createOk && (
            <BigInput
              label="Protocolo"
              value={protocoloBusca}
              onChange={(e) => setProtocoloBusca(e.target.value)}
              placeholder="RL-2026-…"
              className="font-mono"
            />
          )}

          <MobileButton type="submit" disabled={busy}>
            {busy ? "Processando…" : "Gerar senha eletrônica"}
          </MobileButton>
        </form>
      </main>
    </>
  );
}
