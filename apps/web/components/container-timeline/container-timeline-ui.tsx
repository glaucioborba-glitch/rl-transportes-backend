"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ContainerTimelineEvent } from "@/lib/container-timeline";
import { TIMELINE_EVENT_LABELS } from "@/lib/container-timeline";
import { Button } from "@/components/ui/button";

const TONE: Record<string, string> = {
  AGENDAMENTO: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  VISTORIA_EIR: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  GATE_IN: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  PATIO_MOVIMENTO: "border-violet-500/40 bg-violet-500/10 text-violet-100",
  GATE_OUT: "border-lime-500/40 bg-lime-500/10 text-lime-100",
};

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function ContainerTimeline({
  eventos,
  showAdminMeta = false,
  onReprintRic,
  ricBusy,
  className,
}: {
  eventos: ContainerTimelineEvent[];
  showAdminMeta?: boolean;
  onReprintRic?: (tipo: "ENTRADA" | "SAIDA") => void;
  ricBusy?: "ENTRADA" | "SAIDA" | null;
  className?: string;
}) {
  if (!eventos.length) {
    return <p className="text-sm text-slate-500">Nenhum evento registrado para este contêiner.</p>;
  }

  return (
    <ol className={cn("relative space-y-0 border-l border-white/10 pl-6", className)}>
      {eventos.map((ev, idx) => {
        const tone = TONE[ev.tipo] ?? "border-white/15 bg-white/5 text-slate-200";
        const showRic =
          showAdminMeta &&
          onReprintRic &&
          ev.ric?.disponivel &&
          (ev.tipo === "GATE_IN" || ev.tipo === "GATE_OUT");
        const ricTipo = ev.tipo === "GATE_IN" ? "ENTRADA" : "SAIDA";

        return (
          <li key={ev.id} className="relative pb-8 last:pb-0">
            <span
              className={cn(
                "absolute -left-[1.65rem] top-1 flex h-3 w-3 rounded-full ring-4 ring-[#0b101c]",
                idx === eventos.length - 1 ? "bg-[var(--accent)]" : "bg-white/30",
              )}
            />
            <div className={cn("rounded-xl border p-4", tone)}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
                    {TIMELINE_EVENT_LABELS[ev.tipo]}
                  </p>
                  <h3 className="text-base font-semibold text-white">{ev.titulo}</h3>
                  <p className="text-xs opacity-80">{formatWhen(ev.ocorridoEm)}</p>
                </div>
                {ev.protocolo ? (
                  <span className="font-mono text-[10px] text-slate-400">Ref: {ev.protocolo}</span>
                ) : null}
              </div>
              {ev.resumo ? <p className="mt-2 text-sm opacity-90">{ev.resumo}</p> : null}

              {showAdminMeta && ev.metadata ? (
                <dl className="mt-3 grid gap-1 text-xs text-slate-300">
                  {Object.entries(ev.metadata)
                    .filter(([, v]) => v != null && v !== "")
                    .slice(0, 8)
                    .map(([k, v]) => (
                      <div key={k} className="flex flex-wrap gap-1">
                        <dt className="text-slate-500">{k}:</dt>
                        <dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                      </div>
                    ))}
                </dl>
              ) : null}

              {ev.fotos && ev.fotos.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ev.fotos.slice(0, 4).map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt=""
                      className="h-16 w-20 rounded border border-white/10 object-cover"
                    />
                  ))}
                </div>
              ) : null}

              {showRic ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 border-white/20 bg-black/20"
                  disabled={ricBusy === ricTipo}
                  onClick={() => onReprintRic(ricTipo)}
                >
                  {ricBusy === ricTipo ? "Gerando…" : "Reimprimir RIC"}
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ContainerTimelineSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-white/10 bg-[#0b101c] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="container-timeline-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
              Rastreio do contêiner
            </p>
            <h2 id="container-timeline-title" className="font-mono text-xl font-bold text-white">
              {title}
            </h2>
            {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-lg px-3 py-1 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </>
  );
}
