"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Package } from "lucide-react";
import { MobileButton } from "@/components/motorista/mobile-button";
import { MobileHeader } from "@/components/motorista/mobile-header";
import { OperationHeader } from "@/components/motorista/operation-header";
import {
  ApiError,
  motoristaAtualizarOrdemStatus,
  motoristaViagemAtiva,
  type MotoristaViagemResponse,
} from "@/lib/api/motorista-client";
import { toast } from "@/lib/toast";
import { useMotoristaAuthStore } from "@/stores/motorista-auth-store";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  DESPACHADA: "Despachada",
  EM_TRANSITO: "Em trânsito",
  NO_LOCAL: "No local",
  CONCLUIDA: "Concluída",
};

export default function MotoristaViagensPage() {
  const router = useRouter();
  const token = useMotoristaAuthStore((s) => s.accessToken);
  const [data, setData] = useState<MotoristaViagemResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const podInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await motoristaViagemAtiva();
      setData(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setData({ motorista: { id: "", nome: "Motorista" }, viagem: null });
      } else {
        toast.error(e instanceof ApiError ? e.message : "Erro ao carregar viagem");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      router.replace("/motorista/login?next=/motorista/viagens");
      return;
    }
    void load();
  }, [token, router, load]);

  async function mudarStatus(next: string, podFile?: File | null) {
    if (!data?.viagem) return;
    setBusy(true);
    try {
      await motoristaAtualizarOrdemStatus(data.viagem.ordemId, next, podFile);
      toast.success(`Status: ${STATUS_LABEL[next] ?? next}`);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao atualizar");
    } finally {
      setBusy(false);
    }
  }

  const v = data?.viagem;
  const status = v?.status ?? "";

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <MobileHeader title="Minhas viagens" subtitle="Transporte FL — First/Last Mile" />
      {v ? (
        <OperationHeader
          cliente={v.clienteNome}
          isos={[v.numeroIso]}
          tipo={v.tipoOperacao}
          status={STATUS_LABEL[status] ?? status}
        />
      ) : (
        <div className="mt-4 rounded-2xl border border-white/12 bg-black/40 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Motorista</p>
          <p className="truncate text-lg font-bold text-white">{data?.motorista.nome ?? "—"}</p>
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-slate-500">Carregando…</p>
      ) : !v ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-[#0c1018] p-8 text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-semibold text-white">Nenhuma viagem ativa</p>
          <p className="mt-2 text-sm text-slate-500">
            Aguarde o coordenador despachar uma ordem de transporte para você.
          </p>
          <MobileButton type="button" className="mt-6" variant="outline" onClick={() => void load()}>
            Atualizar
          </MobileButton>
        </div>
      ) : (
        <article className="mt-4 overflow-hidden rounded-3xl border-2 border-[var(--accent)]/30 bg-gradient-to-b from-[#0f141c] to-[#080a0d] shadow-2xl">
          <div className="border-b border-white/10 bg-[var(--accent)]/10 px-5 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
              {STATUS_LABEL[status] ?? status}
            </p>
            <p className="font-mono text-2xl font-black text-white">{v.numeroIso}</p>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex gap-3">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-xs uppercase text-slate-500">Origem</p>
                <p className="text-lg font-semibold text-white">{v.origem ?? "Depot FL"}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-orange-400" />
              <div>
                <p className="text-xs uppercase text-slate-500">Destino</p>
                <p className="text-lg font-semibold text-white">{v.destino ?? "Depot FL"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-[10px] uppercase text-slate-500">Booking</p>
                <p className="font-medium text-white">{v.booking ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-[10px] uppercase text-slate-500">Placa</p>
                <p className="font-mono font-medium text-white">{v.veiculoPlaca}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-[10px] uppercase text-slate-500">Carga</p>
                <p className="font-medium text-white">{v.statusCarga}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-[10px] uppercase text-slate-500">Turno</p>
                <p className="font-medium text-white">{v.turno}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-white/10 p-5">
            {status === "DESPACHADA" ? (
              <MobileButton type="button" disabled={busy} onClick={() => void mudarStatus("EM_TRANSITO")}>
                Iniciar viagem
              </MobileButton>
            ) : null}
            {status === "EM_TRANSITO" ? (
              <MobileButton type="button" disabled={busy} onClick={() => void mudarStatus("NO_LOCAL")}>
                Cheguei no local
              </MobileButton>
            ) : null}
            {status === "NO_LOCAL" ? (
              <>
                <input
                  ref={podInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void mudarStatus("CONCLUIDA", file ?? null);
                    e.target.value = "";
                  }}
                />
                <MobileButton
                  type="button"
                  disabled={busy}
                  className={cn("bg-emerald-600 hover:bg-emerald-500")}
                  onClick={() => podInputRef.current?.click()}
                >
                  Finalizar transporte (+ POD opcional)
                </MobileButton>
                <MobileButton
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void mudarStatus("CONCLUIDA")}
                >
                  Finalizar sem foto
                </MobileButton>
              </>
            ) : null}
          </div>
        </article>
      )}
    </div>
  );
}
