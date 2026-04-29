"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DigitalTwinIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/digital-twin/terminal");
  }, [router]);
  return <p className="text-sm text-zinc-500">Carregando Digital Twin…</p>;
}
