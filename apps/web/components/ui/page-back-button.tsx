"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolvePageBackHref } from "@/lib/intranet/page-back-href";

/** Botão padrão intranet: `← Voltar` acima do título, para a rota pai. */
export function PageBackButton({ href }: { href?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const target = href ?? resolvePageBackHref(pathname);
  if (!target) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 text-muted-foreground hover:text-white"
      onClick={() => router.push(target)}
    >
      ← Voltar
    </Button>
  );
}
