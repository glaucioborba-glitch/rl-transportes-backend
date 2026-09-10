import { redirect } from "next/navigation";
import { staffLegacyRedirect } from "@/lib/staff-legacy-redirect";

export default function StaffLegacyCatchAll({ params }: { params: { slug?: string[] } }) {
  const pathname = "/staff" + (params.slug?.length ? `/${params.slug.join("/")}` : "");
  redirect(staffLegacyRedirect(pathname) ?? "/operador/dashboard");
}
