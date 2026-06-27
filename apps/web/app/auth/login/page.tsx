import { redirect } from "next/navigation";

/** Compat: intranet em `/login/staff`. */
export default function LegacyAuthLoginRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams.next;
  const dest =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? raw
      : "/operador/portaria";
  redirect(`/login/staff?next=${encodeURIComponent(dest)}`);
}
