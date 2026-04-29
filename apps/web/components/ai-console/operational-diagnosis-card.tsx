"use client";

export function OperationalDiagnosisCard({ hypotheses }: { hypotheses: string[] }) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80">Causas prováveis · root cause lite</p>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-xs text-zinc-300">
        {hypotheses.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
    </div>
  );
}
