"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getApiBase } from "@/lib/api/corporate-auth-client";

type UseTosSocketOptions = {
  namespace: "/ws/yard" | "/ws/dispatch";
  event: string;
  onEvent: (payload: unknown) => void;
  enabled?: boolean;
  query?: Record<string, string>;
};

export function useTosSocket({
  namespace,
  event,
  onEvent,
  enabled = true,
  query,
}: UseTosSocketOptions) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const base = getApiBase();
    const socket: Socket = io(`${base}${namespace}`, {
      transports: ["websocket"],
      withCredentials: true,
      query,
    });
    const listener = (payload: unknown) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query serializado via clienteId quando aplicável
  }, [namespace, event, enabled, query?.clienteId]);
}
