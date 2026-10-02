"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PatioGradeOrientacao } from "@/components/patio/patio-grade-orientacao";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/staff-client";
import {
  confirmarPatioFila,
  listarPatioFila,
  listarPatioFilaPosicoes,
  remocaoPatioFila,
  type PatioFilaPosicao,
  type PatioFilaTarefa,
  type PatioFilaUrgencia,
} from "@/lib/api/patio-fila-client";
import { formatIsoDisplay } from "@/lib/container-display";
import { PATIO_ZONAS, posicoesOrdemVisual } from "@/lib/patio/patio-posicao";
import { toast } from "@/lib/toast";

const URGENCIA_UI: Record<
  PatioFilaUrgencia,
  { label: string; bar: string; chip: string }
> = {
  PRIORITARIO: {
    label: "Prioritário",
    bar: "bg-orange-500",
    chip: "bg-orange-500 text-zinc-950",
  },
  PREFERENCIAL: {
    label: "Preferencial",
    bar: "bg-amber-400",
    chip: "bg-amber-400 text-zinc-950",
  },
  NORMAL: {
    label: "Normal",
    bar: "bg-emerald-500",
    chip: "bg-emerald-500 text-zinc-950",
  },
};

function rotuloSugestaoFila(item: PatioFilaTarefa) {
  return item.sugestaoLabel?.trim() || "Sem Sugestão";
}

export default function PatioPage() {
  const [fila, setFila] = useState<PatioFilaTarefa[]>([]);
  const [posicoes, setPosicoes] = useState<PatioFilaPosicao[]>([]);
  const [zonas, setZonas] = useState<string[]>([...PATIO_ZONAS]);
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState<PatioFilaTarefa | null>(null);
  const [zona, setZona] = useState("A");
  const [posicao, setPosicao] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [remocaoPergunta, setRemocaoPergunta] = useState<PatioFilaPosicao | null>(null);
  const [remocaoOrigem, setRemocaoOrigem] = useState<PatioFilaPosicao | null>(null);

  const load = useCallback(async () => {
    try {
      const [f, p] = await Promise.all([listarPatioFila(), listarPatioFilaPosicoes()]);
      setFila(f.items);
      setPosicoes(p.items);
      if (p.zonas?.length) setZonas(p.zonas);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar a fila do pátio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    setZona((atual) => (atual && zonas.includes(atual) ? atual : (zonas[0] ?? "")));
  }, [zonas]);

  const selecionadaId = selecionada?.id ?? null;
  useEffect(() => {
    if (!selecionada) {
      setPosicao(null);
      setRemocaoPergunta(null);
      setRemocaoOrigem(null);
      return;
    }
    setZona(selecionada.zonaConhecida ?? selecionada.sugestaoZona ?? zonas[0] ?? "");
    setPosicao(selecionada.posicaoConhecida);
    setRemocaoPergunta(null);
    setRemocaoOrigem(null);
    // Só ao trocar a tarefa — o reload da fila não cancela a remoção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionadaId]);

  const grade = useMemo(() => {
    const daZona = posicoes.filter((p) => p.zona === zona);
    return posicoesOrdemVisual().map((n) => {
      return (
        daZona.find((p) => p.posicao === n) ?? {
          codigo: `${zona}-${n}`,
          zona,
          posicao: n,
          livre: true,
          ocupadaPor: null,
        }
      );
    });
  }, [posicoes, zona]);

  function slotOcupadaPorOutra(slot: PatioFilaPosicao) {
    return !slot.livre && slot.ocupadaPor !== selecionada?.unidadeIso;
  }

  async function executarRemocao(origem: PatioFilaPosicao, destino: PatioFilaPosicao) {
    setBusy(true);
    try {
      await remocaoPatioFila(origem.codigo, destino.codigo);
      toast.success(`Remoção: ${origem.codigo} → ${destino.codigo}`);
      setRemocaoOrigem(null);
      setPosicao(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível concluir a remoção.");
    } finally {
      setBusy(false);
    }
  }

  function clicarPosicao(slot: PatioFilaPosicao) {
    if (busy) return;
    const ocupada = slotOcupadaPorOutra(slot);
    if (remocaoOrigem) {
      if (slot.codigo === remocaoOrigem.codigo) {
        setRemocaoOrigem(null);
        return;
      }
      if (ocupada) {
        setRemocaoPergunta(slot);
        return;
      }
      void executarRemocao(remocaoOrigem, slot);
      return;
    }
    if (ocupada) {
      setRemocaoPergunta(slot);
      return;
    }
    setPosicao((atual) => (atual === slot.posicao ? null : slot.posicao));
  }

  async function finalizar() {
    if (!selecionada) return;
    setBusy(true);
    try {
      await confirmarPatioFila(
        selecionada.id,
        zona && posicao != null ? `${zona}-${posicao}` : undefined,
      );
      toast.success(selecionada.tipo === "COLETA" ? "Coleta finalizada." : "Baixa finalizada.");
      setSelecionada(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível finalizar.");
    } finally {
      setBusy(false);
    }
  }

  if (selecionada) {
    const ui = URGENCIA_UI[selecionada.urgencia];
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col gap-5 px-4 py-5">
        <button
          type="button"
          className="self-start text-sm text-slate-400 hover:text-white"
          onClick={() => {
            setRemocaoPergunta(null);
            setRemocaoOrigem(null);
            setSelecionada(null);
          }}
        >
          ← Voltar à fila
        </button>
        <div className={`h-2 w-full rounded-full ${ui.bar}`} />
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            {selecionada.tipo === "COLETA" ? "Coleta" : "Baixa"} · {ui.label}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-wide text-white">
            {formatIsoDisplay(selecionada.unidadeIso)}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {selecionada.processoLabel ?? "—"} · {selecionada.clienteNome ?? "Cliente"}
          </p>
        </div>

        {selecionada.tipo === "COLETA" && selecionada.posicaoConhecidaCodigo ? (
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            Última posição conhecida: zona {selecionada.zonaConhecida ?? "—"} · posição{" "}
            {selecionada.posicaoConhecida ?? "—"}
          </p>
        ) : (
          <p
            className={`rounded-xl border px-3 py-2 text-sm ${
              selecionada.sugestaoZona
                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-white/5 text-slate-400"
            }`}
          >
            {selecionada.sugestaoZona
              ? `Sugestão: zona ${selecionada.sugestaoZona}`
              : "Sem Sugestão"}
          </p>
        )}

        <PatioMapaGrade
          zonas={zonas}
          zona={zona}
          posicao={posicao}
          grade={grade}
          remocaoOrigem={remocaoOrigem}
          zonaSugerida={selecionada.sugestaoZona}
          busy={busy}
          onZona={(z) => {
            setZona(z);
            if (!remocaoOrigem) setPosicao(null);
          }}
          onSlot={clicarPosicao}
          onCancelarRemocao={() => setRemocaoOrigem(null)}
          isoPropria={selecionada.unidadeIso}
          hint="Verde livre · vermelho ocupado. Toque no vermelho para remover. A posição da baixa não é obrigatória."
        />

        <Button
          className="mt-auto min-h-14 text-base font-bold"
          disabled={busy || Boolean(remocaoOrigem)}
          onClick={() => void finalizar()}
        >
          {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          Finalizar
        </Button>

        <RemocaoDialog
          pergunta={remocaoPergunta}
          onCancelar={() => setRemocaoPergunta(null)}
          onSim={() => {
            if (!remocaoPergunta) return;
            setRemocaoOrigem(remocaoPergunta);
            setRemocaoPergunta(null);
            setPosicao(null);
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 px-4 py-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Pátio</h1>
        <p className="text-sm text-slate-500">
          Prioritário, depois preferencial, depois normal. Dentro do grupo, o mais novo fica por último.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando fila…
        </p>
      ) : null}

      {!loading && fila.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-slate-400">
          Nenhuma unidade na fila. A RIC do Gate envia para cá.
        </p>
      ) : null}

      <div className="space-y-3">
        {fila.map((item) => {
          const ui = URGENCIA_UI[item.urgencia];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelecionada(item)}
              className="flex w-full min-h-[5.5rem] overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f14] text-left hover:border-white/25"
            >
              <span className={`w-2 shrink-0 ${ui.bar}`} />
              <span className="flex flex-1 flex-col justify-center gap-1 px-4 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ui.chip}`}>
                    {ui.label}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {item.tipo === "COLETA" ? "Coleta" : "Baixa"}
                  </span>
                </span>
                <span className="text-xl font-bold tracking-wide text-white">
                  {formatIsoDisplay(item.unidadeIso)}
                </span>
                <span className="text-xs text-slate-400">
                  {item.processoLabel ?? "—"} · {item.clienteNome ?? "Cliente"}
                  {item.tipo === "COLETA" && item.zonaConhecida
                    ? ` · última ${item.zonaConhecida}-${item.posicaoConhecida}`
                    : ""}
                </span>
                {item.tipo === "COLETA" && item.zonaConhecida ? null : (
                  <span
                    className={`text-xs font-semibold ${
                      item.sugestaoZona ? "text-cyan-300" : "text-slate-500"
                    }`}
                  >
                    {item.sugestaoZona
                      ? `Sugestão: ${rotuloSugestaoFila(item)}`
                      : "Sem Sugestão"}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <PatioMapaGrade
        zonas={zonas}
        zona={zona}
        posicao={null}
        grade={grade}
        remocaoOrigem={remocaoOrigem}
        busy={busy}
        onZona={setZona}
        onSlot={clicarPosicao}
        onCancelarRemocao={() => setRemocaoOrigem(null)}
        isoPropria={null}
        zonaSugerida={null}
        hint="Verde livre · vermelho ocupado. Toque no vermelho para uma remoção."
      />

      <RemocaoDialog
        pergunta={remocaoPergunta}
        onCancelar={() => setRemocaoPergunta(null)}
        onSim={() => {
          if (!remocaoPergunta) return;
          setRemocaoOrigem(remocaoPergunta);
          setRemocaoPergunta(null);
          setPosicao(null);
        }}
      />
    </main>
  );
}

function RemocaoDialog({
  pergunta,
  onSim,
  onCancelar,
}: {
  pergunta: PatioFilaPosicao | null;
  onSim: () => void;
  onCancelar: () => void;
}) {
  return (
    <Dialog
      open={Boolean(pergunta)}
      onOpenChange={(open) => {
        if (!open) onCancelar();
      }}
    >
      <DialogContent className="max-w-sm [&>button.absolute]:hidden">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-2xl">Remoção?</DialogTitle>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-col gap-3 sm:flex-col">
          <Button className="min-h-14 w-full text-base font-bold" onClick={onSim}>
            Sim
          </Button>
          <Button variant="outline" className="min-h-14 w-full text-base font-bold" onClick={onCancelar}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatioMapaGrade({
  zonas,
  zona,
  posicao,
  grade,
  remocaoOrigem,
  zonaSugerida,
  busy,
  onZona,
  onSlot,
  onCancelarRemocao,
  isoPropria,
  hint,
}: {
  zonas: string[];
  zona: string;
  posicao: number | null;
  grade: PatioFilaPosicao[];
  remocaoOrigem: PatioFilaPosicao | null;
  zonaSugerida?: string | null;
  busy: boolean;
  onZona: (zona: string) => void;
  onSlot: (slot: PatioFilaPosicao) => void;
  onCancelarRemocao: () => void;
  isoPropria: string | null;
  hint: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Zona</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {zonas.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => onZona(z)}
            className={`min-h-12 rounded-xl border px-4 text-lg font-bold ${
              zona === z
                ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                : zonaSugerida === z
                  ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25"
                  : "border-white/20 bg-black/30 text-white hover:bg-white/10"
            }`}
          >
            {z}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        Posição{" "}
        {remocaoOrigem
          ? `· remoção de ${remocaoOrigem.codigo}`
          : zona && posicao != null
            ? `· ${zona}-${posicao}`
            : "· toque no vermelho para remover"}
      </p>
      {remocaoOrigem ? (
        <p className="mb-3 rounded-xl border border-orange-400/40 bg-orange-400/10 px-3 py-2 text-sm text-orange-100">
          Remoção de {formatIsoDisplay(remocaoOrigem.ocupadaPor ?? "")} em {remocaoOrigem.codigo}.
          Toque numa posição verde livre (pode trocar de zona).{" "}
          <button type="button" className="font-bold underline" onClick={onCancelarRemocao}>
            Cancelar remoção
          </button>
        </p>
      ) : null}
      <PatioGradeOrientacao className="mx-auto w-full max-w-sm" labelClassName="text-slate-500">
        <div className="grid grid-cols-4 gap-3">
          {grade.map((slot) => {
            const origemRemocao = remocaoOrigem?.codigo === slot.codigo;
            const ativa = !remocaoOrigem && posicao === slot.posicao;
            const ocupada = !slot.livre && Boolean(slot.ocupadaPor) && slot.ocupadaPor !== isoPropria;
            return (
              <button
                key={slot.codigo}
                type="button"
                disabled={busy}
                onClick={() => onSlot(slot)}
                className={`aspect-square rounded-md border-2 bg-transparent disabled:opacity-60 ${
                  origemRemocao
                    ? "border-orange-400 bg-orange-400/30"
                    : ativa
                      ? ocupada
                        ? "border-red-500 bg-red-500/20"
                        : "border-emerald-400 bg-emerald-400/20"
                      : ocupada
                        ? "border-red-500"
                        : remocaoOrigem
                          ? "border-emerald-400 bg-emerald-400/10"
                          : "border-emerald-500"
                }`}
                aria-label={`Posição ${slot.posicao}${ocupada ? " ocupada" : " livre"}`}
              />
            );
          })}
        </div>
      </PatioGradeOrientacao>
      <p className="mt-2 text-center text-xs text-slate-500">{hint}</p>
    </div>
  );
}
