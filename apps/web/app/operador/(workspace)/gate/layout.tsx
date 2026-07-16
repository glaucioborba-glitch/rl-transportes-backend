import { GateCockpitLayout } from "@/components/gate/cockpit/gate-cockpit-layout";

/** Gate usa shell unificado da intranet; aqui só o provider + topbar + conteúdo. */
export default function GateWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <GateCockpitLayout>{children}</GateCockpitLayout>;
}
