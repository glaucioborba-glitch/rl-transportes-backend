"use client";

import { ClienteAdminFiscalForm } from "../cliente-fiscal-form";

export default function AdminClienteNovoPage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Novo cliente</h1>
          <p className="text-sm text-zinc-500">POST /clientes · cadastro fiscal NFS-e</p>
        </div>
      </div>

      <ClienteAdminFiscalForm />
    </div>
  );
}
