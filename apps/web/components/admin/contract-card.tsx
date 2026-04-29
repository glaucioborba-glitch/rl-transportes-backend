import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ContractCard({
  title,
  subtitle,
  footer,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-sky-500/15 bg-[#0a0f18]/90 backdrop-blur-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold tracking-tight text-white">{title}</CardTitle>
        {subtitle ? <p className="text-[11px] font-medium uppercase tracking-wider text-sky-500/70">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-zinc-300">
        {children}
        {footer ? <div className="border-t border-white/5 pt-3">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
