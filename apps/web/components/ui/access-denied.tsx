import { ShieldX } from "lucide-react";

type Props = {
  title?: string;
  message?: string;
};

export function AccessDenied({
  title = "Acesso Negado",
  message = "Você não tem permissão para acessar este módulo.",
}: Props) {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
      <ShieldX className="h-16 w-16 text-red-500/50" />
      <div className="text-center">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
