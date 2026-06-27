"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BiWorkspace } from "@/components/bi/bi-workspace";
import { VisaoOperacionalPanel } from "@/components/bi/visao-operacional-panel";
import { fetchVisaoOperacional } from "@/lib/api/bi-analytics-client";
import type { VisaoOperacionalResponse } from "@/lib/api/bi-analytics-types";
import { ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function VisaoOperacionalPage() {
  const router = useRouter();
  const role = useStaffAuthStore((s) => s.user?.role);
  const [data, setData] = useState<VisaoOperacionalResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role && role !== "ADMIN" && role !== "GERENTE") {
      router.replace("/login/staff");
    }
  }, [role, router]);

  useEffect(() => {
    if (role !== "ADMIN" && role !== "GERENTE") return;
    void (async () => {
      setLoading(true);
      try {
        setData(await fetchVisaoOperacional());
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Falha ao carregar Visão Operacional");
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  if (role && role !== "ADMIN" && role !== "GERENTE") {
    return (
      <BiWorkspace>
        <p className="text-sm text-amber-400">Visão Operacional restrita a GERENTE / ADMIN.</p>
      </BiWorkspace>
    );
  }

  return (
    <BiWorkspace>
      {loading || !data ? (
        <p className="text-sm text-zinc-500">Carregando Visão Operacional…</p>
      ) : (
        <VisaoOperacionalPanel data={data} />
      )}
    </BiWorkspace>
  );
}
