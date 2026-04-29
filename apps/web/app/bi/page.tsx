"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BiIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/bi/operacional");
  }, [router]);
  return <p className="text-sm text-zinc-500">Carregando BI…</p>;
}
