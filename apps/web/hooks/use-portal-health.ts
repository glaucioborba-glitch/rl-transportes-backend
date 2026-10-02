"use client";

import { useEffect, useState } from "react";
import {
  getPortalHealthSnapshot,
  subscribePortalHealth,
  type PortalHealthResponse,
} from "@/lib/api/portal-client";

/** Snapshot do GET `/health` (polling 60s / erro 120s via `ensurePortalHealthPolling`). */
export function usePortalHealth(): PortalHealthResponse | null {
  const [health, setHealth] = useState<PortalHealthResponse | null>(() => getPortalHealthSnapshot());
  useEffect(() => subscribePortalHealth(setHealth), []);
  return health;
}
