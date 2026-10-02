"use client";

import { DeviceSessionPanel } from "@/components/security/device-session-panel";
import { portalJson } from "@/lib/api/portal-client";

export default function PortalDispositivosPage() {
  return (
    <DeviceSessionPanel
      title="Dispositivos Conectados"
      loadSessions={() => portalJson("/cliente/portal/sessoes-ativas")}
      loadAudit={() => portalJson("/cliente/portal/sessoes-ativas/auditoria")}
      killSession={(sessionId) =>
        portalJson(`/cliente/portal/sessoes-ativas/${sessionId}`, { method: "DELETE" }).then(() => undefined)
      }
    />
  );
}
