"use client";

import { Suspense } from "react";
import { SelectPessoaContent } from "./select-pessoa-content";

export default function SelectPessoaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#080a0d] text-slate-400">
          Carregando…
        </div>
      }
    >
      <SelectPessoaContent />
    </Suspense>
  );
}
