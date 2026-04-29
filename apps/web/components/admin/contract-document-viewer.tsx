"use client";

export function ContractDocumentViewer({ url, title }: { url: string | null; title: string }) {
  if (!url) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-white/15 bg-zinc-950/50 text-sm text-zinc-500">
        Nenhum PDF anexado para {title}.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
      <p className="border-b border-white/10 px-3 py-2 text-xs font-medium text-zinc-400">{title}</p>
      <iframe title={title} src={url} className="h-[520px] w-full bg-zinc-900" />
    </div>
  );
}
