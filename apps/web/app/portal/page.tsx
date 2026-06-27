import { redirect } from "next/navigation";

/** /portal sem segmento → dashboard (evita 404 e alinha com middleware). */
export default function PortalRootPage() {
  redirect("/portal/dashboard");
}
