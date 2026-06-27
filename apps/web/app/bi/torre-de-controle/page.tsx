"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BiWorkspace } from "@/components/bi/bi-workspace";
import { TorreControlePanel } from "@/components/bi/torre-controle-panel";
import { fetchTorreControle } from "@/lib/api/bi-analytics-client";
import type { TorreControleResponse } from "@/lib/api/bi-analytics-types";
import { ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function TorreControlePage() {
  const router = useRouter();
  const role = useStaffAuthStore((s) => s.user?.role);
  const [data, setData] = useState<TorreControleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role && role !== "ADMIN") {
      router.replace("/bi/visao-operacional");
    }
  }, [role, router]);

  useEffect(() => {
    if (role !== "ADMIN") return;
    void (async () => {
      setLoading(true);
      try {
        setData(await fetchTorreControle());
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Falha ao carregar Torre de Controle");
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  if (role && role !== "ADMIN") {
    return (
      <BiWorkspace>
        <p className="text-sm text-amber-400">Torre de Controle restrita a ADMIN.</p>
      </BiWorkspace>
    );
  }

  return (
    <BiWorkspace>
      {loading || !data ? (
        <p className="text-sm text-zinc-500">Carregando Torre de Controle…</p>
      ) : (
        <TorreControlePanel data={data} />
      )}
    </BiWorkspace>
  );
}
