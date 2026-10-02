import { redirect } from "next/navigation";

/** Tipos de contêiner saíram do tenant — cadastro fica no Super Admin. */
export default function EditarTipoContainerMovedPage() {
  redirect("/cadastros/operacional");
}
