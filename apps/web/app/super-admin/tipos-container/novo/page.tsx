"use client";

import Link from "next/link";
import { SuperAdminTipoContainerForm } from "@/components/super-admin/tipo-container-form";

export default function SuperAdminNovoTipoContainerPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-sm text-zinc-500">
          <Link href="/super-admin/tipos-container" className="hover:text-white">
            Tipos de contêiner
          </Link>
          <span> / Novo</span>
        </p>
        <h2 className="text-lg font-semibold text-white">Novo tipo de contêiner</h2>
        <p className="text-sm text-zinc-400">Vale para todos os terminais.</p>
      </div>
      <SuperAdminTipoContainerForm />
    </div>
  );
}
