import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormSectionProps = {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
};

export function FormSection({ title, icon: Icon, children, className }: FormSectionProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

type FormFieldProps = {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function FormField({ label, required, children, className }: FormFieldProps) {
  return (
    <div className={cn(className)}>
      <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
        {label} {required ? <span className="text-red-400">*</span> : null}
      </label>
      {children}
    </div>
  );
}
