import { redirect } from "next/navigation";

export const metadata = {
  title: "Intranet | RL Transportes",
};

/** `/login` → intranet staff (CPF-only). Portal do cliente: `/portal/login`. */
export default function IntranetLoginRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams.next;
  const next =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
  redirect(next ? `/login/staff?next=${encodeURIComponent(next)}` : "/login/staff");
}
