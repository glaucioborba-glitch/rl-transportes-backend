"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/executivo");
  }, [router]);
  return <p className="text-sm text-zinc-500">Redirecionando…</p>;
}
