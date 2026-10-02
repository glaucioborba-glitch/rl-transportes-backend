"use client";

import { AVARIAS_RAPIDAS, type VistoriaPortalRow } from "@/lib/gate-vistoria";
import { formatDateTime } from "@/lib/portal-tracking";

function avariaLabel(id: string): string {
  return AVARIAS_RAPIDAS.find((a) => a.id === id)?.label ?? id;
}

export function VistoriaGallery({ vistorias }: { vistorias: VistoriaPortalRow[] }) {
  if (!vistorias.length) {
    return (
      <p className="text-sm text-slate-500">
        Nenhuma vistoria fotográfica registrada ainda. As fotos aparecem após gate-in/out operacional.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {vistorias.map((v) => (
        <section key={v.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              {v.tipo === "GATE_IN" ? "Vistoria de entrada" : "Vistoria de saída"}
            </h3>
            <span className="text-xs text-slate-500">{formatDateTime(v.criadoEm)}</span>
          </div>

          {v.avarias.length ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {v.avarias.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200"
                >
                  {avariaLabel(a)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-xs text-emerald-400/90">Sem avarias registradas nesta vistoria.</p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {v.fotos.map((f) => (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-lg border border-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt={f.angulo}
                  className="aspect-[4/3] w-full object-cover transition group-hover:opacity-90"
                />
                <p className="bg-black/60 px-2 py-1 text-center text-[10px] uppercase tracking-wide text-slate-400">
                  {f.angulo.replace(/_/g, " ")}
                </p>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
