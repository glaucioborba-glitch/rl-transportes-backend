import { redirect } from "next/navigation";
import { sanitizePortalNext } from "@/lib/portal-redirect";

export const metadata = {
  title: "Redirecionando… | RL Transportes",
};

/** Compat: `/login` → `/portal/login`. */
export default function LegacyLoginRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const next = encodeURIComponent(sanitizePortalNext(searchParams.next));
  redirect(`/portal/login?next=${next}`);
}
