"use client";



import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, staffGateCockpit } from "@/lib/api/staff-client";

import type { GateCockpitPayload } from "@/lib/gate/gate-cockpit-types";

import { useTosSocket } from "@/lib/realtime/use-tos-socket";

import { GATE_POLLING_INTERVAL_MS, GATE_WEBSOCKET_ENABLED } from "@/lib/dev-performance";

import { API_ERROR_CONNECTION } from "@/hooks/use-api-health";

import { toast } from "@/lib/toast";



const POLL_MS = GATE_POLLING_INTERVAL_MS;



function todayIso() {

  return new Date().toISOString().slice(0, 10);

}



export function useGateCockpit(dataRef?: string) {

  const ref = dataRef?.trim() || todayIso();

  const [data, setData] = useState<GateCockpitPayload | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<ApiError | null>(null);

  const [lastSync, setLastSync] = useState<string | null>(null);

  const busyRef = useRef(false);



  const refresh = useCallback(

    async (silent = false) => {

      if (busyRef.current) return;

      busyRef.current = true;

      if (!silent) setLoading(true);

      try {

        const payload = await staffGateCockpit(ref);

        setData(payload);

        setError(null);

        setLastSync(new Date().toISOString());

      } catch (e) {

        const apiErr =

          e instanceof ApiError

            ? e

            : new ApiError(

                e instanceof Error ? e.message : "Erro ao carregar cockpit do Gate",

                0,

                undefined,

                API_ERROR_CONNECTION,

              );

        setError(apiErr);

        if (!silent) {

          if (apiErr.code !== API_ERROR_CONNECTION) {

            toast.error(apiErr.message);

          }

        }

      } finally {

        busyRef.current = false;

        setLoading(false);

      }

    },

    [ref],

  );



  useEffect(() => {

    void refresh();

    const id = window.setInterval(() => void refresh(true), POLL_MS);

    return () => window.clearInterval(id);

  }, [refresh]);



  useTosSocket({

    namespace: "/ws/yard",

    event: "yard_updated",

    onEvent: () => void refresh(true),

    enabled: GATE_WEBSOCKET_ENABLED,

  });



  return { data, loading, error, lastSync, refresh: (silent?: boolean) => refresh(silent ?? false) };

}


