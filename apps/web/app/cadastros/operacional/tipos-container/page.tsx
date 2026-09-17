import { redirect } from "next/navigation";

/** Tipos de contêiner saíram do tenant — cadastro fica no Super Admin. */
export default function TiposContainerMovedPage() {
  redirect("/cadastros/operacional");
}
