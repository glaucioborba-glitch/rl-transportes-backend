import type { LucideIcon } from "lucide-react";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description: string;
  tabs: string[];
  placeholderMessage: string;
  icon?: LucideIcon;
};

export function CadastrosBlocoPlaceholder({
  title,
  description,
  tabs,
  placeholderMessage,
  icon: Icon = Database,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="default" disabled>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cadastro
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <Button key={tab} variant="ghost" size="sm" className="text-sm" disabled>
            {tab}
          </Button>
        ))}
      </div>

      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Icon className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg text-muted-foreground">{placeholderMessage}</p>
        <p className="text-sm text-muted-foreground/70">
          A estrutura base e o sistema de permissões já estão prontos.
        </p>
      </div>
    </div>
  );
}
