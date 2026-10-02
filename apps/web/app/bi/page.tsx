"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function BiIndexPage() {
  const router = useRouter();
  const role = useStaffAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (role === "ADMIN") {
      router.replace("/bi/torre-de-controle");
      return;
    }
    if (role === "GERENTE") {
      router.replace("/bi/visao-operacional");
      return;
    }
    router.replace("/bi/visao-operacional");
  }, [router, role]);

  return <p className="text-sm text-zinc-500">Carregando BI…</p>;
}
