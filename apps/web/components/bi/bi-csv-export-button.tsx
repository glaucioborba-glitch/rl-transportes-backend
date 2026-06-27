"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/bi/csv-export";

type Props = {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  label?: string;
};

/** Botão discreto para exportar tabela bruta em CSV. */
export function BiCsvExportButton({ filename, headers, rows, label = "Exportar CSV" }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 text-xs text-zinc-500 hover:text-zinc-200"
      onClick={() => downloadCsv(filename, headers, rows)}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
