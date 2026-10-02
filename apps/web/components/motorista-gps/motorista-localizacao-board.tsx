"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  fetchMotoristaLocalizacaoMapa,
  formatEtaChegada,
  motoristaGpsDestinoKey,
  motoristaGpsItemKey,
  type MotoristaGpsDestino,
  type MotoristaGpsMapaItem,
} from "@/lib/api/motorista-gps-client";
import { ApiError } from "@/lib/api/corporate-auth-client";
import { labelTipoLocalTransporte } from "@/lib/api/cadastros-locais-transporte-client";
import { resolveGoogleMapsApiKey } from "@/lib/google-maps-loader";
import { cn } from "@/lib/utils";

const MotoristaLocalizacaoOsm = dynamic(
  () => import("@/components/motorista-gps/motorista-localizacao-map").then((m) => m.MotoristaLocalizacaoMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">Carregando mapa…</div>
    ),
  },
);

const MotoristaLocalizacaoGoogle = dynamic(
  () =>
    import("@/components/motorista-gps/motorista-localizacao-google-map").then(
      (m) => m.MotoristaLocalizacaoGoogleMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">Carregando mapa…</div>
    ),
  },
);

function formatHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

export function MotoristaLocalizacaoBoard() {
  const [items, setItems] = useState<MotoristaGpsMapaItem[]>([]);
  const [destinos, setDestinos] = useState<MotoristaGpsDestino[]>([]);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [focoKey, setFocoKey] = useState<string | null>(null);
  const [focoSeq, setFocoSeq] = useState(0);
  const [mapsKey, setMapsKey] = useState<string | null>(null);

  useEffect(() => {
    void resolveGoogleMapsApiKey().then(setMapsKey);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchMotoristaLocalizacaoMapa(destinoId);
      setItems(data.items);
      setDestinos(data.destinos);
      setDestinoId((atual) => atual ?? data.destinoId);
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Não foi possível carregar a localização");
    }
  }, [destinoId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8_000);
    return () => window.clearInterval(id);
  }, [load]);

  const online = items.filter((i) => i.online).length;
  const destino = destinos.find((d) => d.id === destinoId) ?? null;

  const escolherDestino = (id: string) => {
    setDestinoId(id);
    setFocoKey(motoristaGpsDestinoKey(id));
    setFocoSeq((n) => n + 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">Localização</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Motoristas internos e terceiros da RL. {online} online agora
          {mapsKey ? " · trânsito ao vivo (Google)" : ""}
          {destino
            ? ` · chegada até ${destino.nome}`
            : " · chegada até o terminal (cadastre o ponto em Origens e destinos)"}
          . No Fretes o destino do embarque sairá desta mesma lista.
        </p>
        {err ? <p className="mt-1 text-sm text-red-400">{err}</p> : null}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-0 overflow-hidden rounded-lg border border-white/10">
          {mapsKey ? (
            <MotoristaLocalizacaoGoogle
              items={items}
              destinos={destinos}
              destinoId={destinoId}
              focoKey={focoKey}
              focoSeq={focoSeq}
              onSelectDestino={escolherDestino}
            />
          ) : (
            <MotoristaLocalizacaoOsm
              items={items}
              destinos={destinos}
              destinoId={destinoId}
              focoKey={focoKey}
              focoSeq={focoSeq}
              onSelectDestino={escolherDestino}
            />
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border border-white/10 bg-zinc-900/40 p-3">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Destinos</p>
            {destinos.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum local ativo em Origens e destinos.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {destinos.map((d) => {
                  const temPonto = d.lat != null && d.lng != null;
                  const ativo = destinoId === d.id;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        disabled={!temPonto}
                        title={temPonto ? "Usar como destino do ETA" : "Cadastre a coordenada em Origens e destinos"}
                        onClick={() => escolherDestino(d.id)}
                        className={cn(
                          "w-full rounded-md border p-3 text-left transition",
                          ativo ? "border-amber-400 bg-amber-500/15" : "border-white/10 bg-zinc-950/60",
                          temPonto ? "hover:border-white/40 hover:bg-zinc-900" : "cursor-not-allowed opacity-55",
                        )}
                      >
                        <p className="font-medium leading-tight">{d.nome}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {d.codigo} · {labelTipoLocalTransporte(d.tipo)}
                          {d.cidade ? ` · ${d.cidade}${d.uf ? `/${d.uf}` : ""}` : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {temPonto ? (ativo ? "Destino do ETA" : "No mapa") : "Sem ponto no mapa"}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Motoristas</p>
            <ul className="flex flex-col gap-2">
              {items.length === 0 ? (
                <li className="text-sm text-zinc-500">Nenhum motorista ativo no cadastro.</li>
              ) : (
                items.map((row) => {
                  const key = motoristaGpsItemKey(row);
                  const temPosicao = row.lat != null && row.lng != null;
                  const ativo = focoKey === key;
                  const eta = formatEtaChegada(row);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        disabled={!temPosicao}
                        title={temPosicao ? "Mostrar no mapa" : "Sem posição ainda"}
                        onClick={() => {
                          setFocoKey(key);
                          setFocoSeq((n) => n + 1);
                        }}
                        className={cn(
                          "w-full rounded-md border p-3 text-left transition",
                          ativo ? "border-cyan-400 bg-cyan-500/15" : "border-white/10 bg-zinc-950/60",
                          temPosicao ? "hover:border-white/40 hover:bg-zinc-900" : "cursor-not-allowed opacity-55",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium leading-tight">{row.nome}</p>
                          <span className={row.online ? "text-xs font-semibold text-cyan-300" : "text-xs text-zinc-500"}>
                            {row.online ? "Online" : "Offline"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          {row.tipo}
                          {row.placaCavalo ? ` · ${row.placaCavalo}` : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {temPosicao ? `Atualizado ${formatHora(row.atualizadoEm)}` : "Sem GPS"}
                        </p>
                        {eta ? <p className="mt-1 text-xs font-medium text-cyan-300">{eta}</p> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
