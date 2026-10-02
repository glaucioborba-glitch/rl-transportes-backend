import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  total: number;
  onChange: (page: number) => void;
};

export function PaginationSimple({ page, total, onChange }: Props) {
  if (total <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        Página {page} de {total}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
