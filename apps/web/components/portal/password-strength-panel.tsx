"use client";

import { cn } from "@/lib/utils";
import { evaluatePassword, type PasswordChecklist } from "@/lib/security/password-validator";

const ROWS: { key: keyof PasswordChecklist; label: string }[] = [
  { key: "minLength", label: "Mínimo de 8 caracteres" },
  { key: "upper", label: "Uma letra maiúscula" },
  { key: "lower", label: "Uma letra minúscula" },
  { key: "digit", label: "Um número" },
  { key: "special", label: "Um caractere especial (!@#$%*?)" },
  { key: "noLongRepeat", label: "Sem repetições longas do mesmo caractere" },
  { key: "noSequence", label: "Sem sequências previsíveis (ex.: 12345, abcde)" },
  { key: "notBlacklisted", label: "Não pode ser uma senha comum bloqueada" },
];

type Props = { password: string };

export function PasswordStrengthPanel({ password }: Props) {
  const { checklist, strength } = evaluatePassword(password);
  const labels = ["Fraca", "Regular", "Média", "Forte", "Muito forte"];

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">Força da senha</span>
        <span
          className={cn(
            "text-xs font-medium",
            strength <= 1 ? "text-amber-400" : strength <= 3 ? "text-yellow-300" : "text-emerald-400",
          )}
        >
          {password.length ? labels[strength] : "—"}
        </span>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-slate-700 transition-colors",
              strength > i && (strength <= 2 ? "bg-amber-500" : strength === 3 ? "bg-yellow-400" : "bg-emerald-500"),
            )}
          />
        ))}
      </div>
      <ul className="space-y-1.5 text-[11px] leading-snug text-slate-400">
        {ROWS.map(({ key, label }) => (
          <li key={key} className="flex items-start gap-2">
            <span
              className={cn(
                "mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px]",
                checklist[key]
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
                  : "border-slate-600 text-transparent",
              )}
              aria-hidden
            >
              ✓
            </span>
            <span className={cn(checklist[key] && "text-slate-300")}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
