"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContainerTimeline,
  ContainerTimelineSheet,
} from "@/components/container-timeline/container-timeline-ui";
import { ApiError, portalContainerTimeline } from "@/lib/api/portal-client";
import type { ContainerTimelineResponse } from "@/lib/container-timeline";
import { toast } from "@/lib/toast";

export function PortalContainerTimelineSlideOver({
  iso,
  open,
  onClose,
}: {
  iso: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<ContainerTimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!iso || !open) return;
    setLoading(true);
    try {
      setData(await portalContainerTimeline(iso));
    } catch (e) {
      setData(null);
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar o rastreio.");
    } finally {
      setLoading(false);
    }
  }, [iso, open]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ContainerTimelineSheet
      open={open}
      onClose={onClose}
      title={data?.isoFormatado ?? iso ?? "Contêiner"}
      subtitle="Transparência operacional — datas, gate e evidências públicas"
    >
      {loading ? <Skeleton className="h-64 w-full" /> : null}
      {!loading && data ? (
        <ContainerTimeline eventos={data.eventos} showAdminMeta={false} />
      ) : null}
    </ContainerTimelineSheet>
  );
}
