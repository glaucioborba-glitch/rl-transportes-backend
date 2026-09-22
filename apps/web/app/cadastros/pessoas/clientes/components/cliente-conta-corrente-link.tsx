"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { obterContaCorrente } from "@/lib/api/conta-corrente-client";
import { Button } from "@/components/ui/button";
import { NotificationBadge } from "@/components/ui/notification-badge";

export function ClienteContaCorrenteLink({ clienteId }: { clienteId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    obterContaCorrente(clienteId)
      .then((out) => {
        if (alive) setCount(out.cliente.comprovantesPendentes ?? out.comprovantesPendentes?.length ?? 0);
      })
      .catch(() => {
        if (alive) setCount(0);
      });
    return () => {
      alive = false;
    };
  }, [clienteId]);

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/financeiro/conta-corrente/${clienteId}`} className="inline-flex items-center gap-1.5">
        <BookOpen className="h-3.5 w-3.5" />
        Conta corrente
        <NotificationBadge count={count} />
      </Link>
    </Button>
  );
}
