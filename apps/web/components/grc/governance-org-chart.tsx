"use client";

export function GovernanceOrgChart() {
  return (
    <div className="overflow-x-auto py-4">
      <div className="mx-auto min-w-[640px] max-w-3xl space-y-6 text-center text-sm">
        <div className="rounded-2xl border border-indigo-500/40 bg-indigo-950/30 px-6 py-4 font-semibold text-indigo-100 shadow-lg">Diretoria</div>
        <div className="mx-auto h-6 w-px bg-gradient-to-b from-indigo-500/50 to-transparent" />
        <div className="rounded-2xl border border-violet-500/35 bg-violet-950/25 px-6 py-4 font-semibold text-violet-100">Comitê de Auditoria / Riscos</div>
        <div className="mx-auto h-6 w-px bg-gradient-to-b from-violet-500/40 to-transparent" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-cyan-100">Gerente Administrativo</div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-cyan-100">Controller / Compliance</div>
        </div>
        <div className="mx-auto h-6 w-px bg-zinc-700" />
        <div className="grid gap-3 sm:grid-cols-3">
          {["Dono Operações", "Dono Financeiro", "Dono RH"].map((lbl) => (
            <div key={lbl} className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
              {lbl}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-600">Modelo referencial — ajustar à estrutura societária real.</p>
      </div>
    </div>
  );
}
