import { redirect } from "next/navigation";

/** Compat: intranet em `/login/staff`. */
export default function OperadorLoginRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams.next;
  const dest =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? raw
      : "/login/staff";
  if (dest === "/login/staff") {
    redirect("/login/staff");
  }
  redirect(`/login/staff?next=${encodeURIComponent(dest)}`);
}
