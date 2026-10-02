"use client";

import { SectionTitle } from "@/components/portal/portal-primitives";
import { DispatchBoard } from "@/components/dispatch/dispatch-board";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export default function OperadorDispatchPage() {
  const [key, setKey] = useState(0);

  return (
    <main className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SectionTitle
          title="Dispatch Board"
          description="Arraste agendamentos FROTA_FL do backlog para a coluna do motorista disponível."
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setKey((k) => k + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>
      <DispatchBoard key={key} />
    </main>
  );
}
