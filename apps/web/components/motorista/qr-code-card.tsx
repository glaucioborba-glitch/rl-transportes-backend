"use client";

import { useMemo } from "react";
import { QrCode } from "lucide-react";

export function QrCodeCard({
  data,
  caption,
}: {
  data: string;
  caption?: string;
}) {
  const src = useMemo(() => {
    const enc = encodeURIComponent(data.slice(0, 1800));
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${enc}`;
  }, [data]);

  return (
    <div className="rounded-2xl border-2 border-white/15 bg-black/40 p-4 text-center">
      <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-white">
        <QrCode className="h-5 w-5 text-[var(--accent)]" />
        QR da operação
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QR Code" className="mx-auto h-52 w-52 rounded-lg bg-white p-2" loading="lazy" />
      {caption ? <p className="mt-3 break-all text-xs text-slate-400">{caption}</p> : null}
    </div>
  );
}
