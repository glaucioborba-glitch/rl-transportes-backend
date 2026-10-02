import { notFound } from "next/navigation";
import { EmailPreviewDevClient } from "./email-preview-dev-client";

export default function PortalDevEmailPreviewPage({
  searchParams,
}: {
  searchParams: { token?: string; nome?: string };
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <EmailPreviewDevClient token={searchParams.token} nome={searchParams.nome} />;
}
