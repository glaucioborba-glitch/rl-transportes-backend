"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SuperAdminTipoContainerForm } from "@/components/super-admin/tipo-container-form";

export default function SuperAdminEditarTipoContainerPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-sm text-zinc-500">
          <Link href="/super-admin/tipos-container" className="hover:text-white">
            Tipos de contêiner
          </Link>
          <span> / Editar</span>
        </p>
        <h2 className="text-lg font-semibold text-white">Editar tipo de contêiner</h2>
        <p className="text-sm text-zinc-400">A alteração vale para todos os terminais.</p>
      </div>
      {id ? <SuperAdminTipoContainerForm tipoId={id} /> : null}
    </div>
  );
}
