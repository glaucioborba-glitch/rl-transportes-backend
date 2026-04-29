"use client";

import { ImageIcon } from "lucide-react";

function asUrl(entry: unknown): string | null {
  if (typeof entry === "string") {
    if (entry.startsWith("data:")) return entry;
    if (entry.startsWith("http")) return entry;
    return `data:image/jpeg;base64,${entry}`;
  }
  if (entry && typeof entry === "object" && "url" in entry && typeof (entry as { url: unknown }).url === "string") {
    return (entry as { url: string }).url;
  }
  if (entry && typeof entry === "object" && "base64" in entry) {
    const b = (entry as { base64?: string }).base64;
    if (typeof b === "string") return `data:image/jpeg;base64,${b}`;
  }
  return null;
}

export function ProofGallery({ title, items }: { title: string; items: unknown }) {
  const list = Array.isArray(items) ? items : [];
  const urls = list.map(asUrl).filter((u): u is string => Boolean(u));

  if (!urls.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-4 text-center text-sm text-slate-500">
        {title}: sem imagens
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <ImageIcon className="h-4 w-4" />
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {urls.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${i}-${src.slice(0, 32)}`}
            src={src}
            alt=""
            className="h-28 w-full rounded-lg border border-white/10 object-cover"
          />
        ))}
      </div>
    </div>
  );
}
