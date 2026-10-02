import { redirect } from "next/navigation";

/** Documentos fiscais ficam em Financeiro (FAT, NFS-e, boleto). */
export default function PortalDocumentosRedirectPage() {
  redirect("/portal/financeiro");
}
