"use client";

import { DeviceSessionPanel } from "@/components/security/device-session-panel";
import { staffJson } from "@/lib/api/staff-client";

export default function StaffDispositivosPage() {
  return (
    <DeviceSessionPanel
      title="Dispositivos Conectados"
      loadSessions={() => staffJson("/auth/sessoes-ativas")}
      loadAudit={() => staffJson("/auth/sessoes-ativas/auditoria")}
      killSession={(sessionId) =>
        staffJson(`/auth/sessoes-ativas/${sessionId}`, { method: "DELETE" }).then(() => undefined)
      }
    />
  );
}
