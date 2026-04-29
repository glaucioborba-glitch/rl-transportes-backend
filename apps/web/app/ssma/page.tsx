"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SsmaIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/ssma/incidentes");
  }, [router]);
  return <p className="p-4 text-sm text-zinc-500">Carregando SSMA…</p>;
}
