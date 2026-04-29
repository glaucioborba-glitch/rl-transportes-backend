import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PortalCard({
  className,
  children,
  ...props
}: ComponentProps<typeof Card>) {
  return (
    <Card className={cn("", className)} {...props}>
      {children}
    </Card>
  );
}

export function SectionTitle({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
    </div>
  );
}

export function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-300">{title}</CardTitle>
        {Icon ? <Icon className="h-5 w-5 text-[var(--accent)]" strokeWidth={1.5} /> : null}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums text-white">{value}</p>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export { CardHeader, CardTitle, CardDescription, CardContent };
