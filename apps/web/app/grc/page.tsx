"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GrcIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/grc/executivo");
  }, [router]);
  return <p className="px-4 py-8 text-sm text-zinc-500">Carregando GRC…</p>;
}
