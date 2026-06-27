"use client";

import Link from "next/link";
import { ClienteAdminFiscalForm } from "../cliente-fiscal-form";

export default function AdminClienteNovoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Novo cliente</h1>
          <p className="text-sm text-zinc-500">POST /clientes · cadastro fiscal NFS-e</p>
        </div>
        <Link href="/admin/executivo" className="text-sm text-zinc-400 hover:text-white">
          Voltar
        </Link>
      </div>

      <ClienteAdminFiscalForm />
    </div>
  );
}
