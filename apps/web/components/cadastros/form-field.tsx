import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Página de cadastro: o shell já centraliza 90% da área útil. */
export const CADASTRO_PAGE_CLASS = "space-y-6";

/** Formulário ocupa a largura da página (90% da área útil, via IntranetShell). */
export const CADASTRO_FORM_CLASS = "w-full space-y-8 pb-8";

/** Larguras com 2–3 dígitos a mais que o conteúdo (CPF, CNPJ, CEP, placa, UF). */
const FIELD_WIDTH = {
  xs: "w-[5.75rem] shrink-0",
  sm: "w-[11rem] shrink-0",
  md: "w-[16.5rem] shrink-0",
  lg: "w-[22rem] shrink-0",
  fill: "w-full",
} as const;

export type FormFieldSize = keyof typeof FIELD_WIDTH;

type FormSectionProps = {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function FormSection({ title, icon: Icon, children, className, action }: FormSectionProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        {action}
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
  /** Largura pelo conteúdo esperado. Sem size, o campo acompanha o flex. */
  size?: FormFieldSize;
};

export function FormField({ label, required, children, className, size }: FormFieldProps) {
  return (
    <div className={cn(size ? FIELD_WIDTH[size] : undefined, className)}>
      <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
        {label} {required ? <span className="text-red-400">*</span> : null}
      </label>
      {children}
    </div>
  );
}
