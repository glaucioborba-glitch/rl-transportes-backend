import { PortalDashboardClient } from "./dashboard-client";
import { Suspense } from "react";

export const metadata = {
  title: "Dashboard | Portal RL Transportes",
};

export default function PortalDashboardPage() {
  return (
    <Suspense fallback={null}>
      <PortalDashboardClient />
    </Suspense>
  );
}
