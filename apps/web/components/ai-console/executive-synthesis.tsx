"use client";

export function ExecutiveSynthesis({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101018] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Síntese executiva</p>
      <p className="mt-4 text-sm leading-relaxed text-zinc-200">{text}</p>
    </div>
  );
}
