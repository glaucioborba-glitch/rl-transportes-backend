import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RhCardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function RhCard({ title, subtitle, children, className, action }: RhCardProps) {
  return (
    <Card className={cn("border-cyan-500/15 bg-zinc-950/80", className)}>
      {(title || subtitle || action) && (
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            {title ? <CardTitle className="text-base text-white">{title}</CardTitle> : null}
            {subtitle ? <p className="mt-1 text-xs text-zinc-500">{subtitle}</p> : null}
          </div>
          {action}
        </CardHeader>
      )}
      <CardContent className={title || subtitle || action ? "pt-0" : "pt-6"}>{children}</CardContent>
    </Card>
  );
}
