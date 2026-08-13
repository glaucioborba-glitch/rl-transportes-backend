"use client";

import type { PermissoesPessoa } from "@/stores/pessoaPermissoesStore";
import { PERM_LABELS_OPERACIONAIS } from "@/lib/permissoes-operacionais";

export function PermissoesOperacionaisFields({
  value,
  onChange,
  disabled,
}: {
  value: PermissoesPessoa;
  onChange: (next: PermissoesPessoa) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      {PERM_LABELS_OPERACIONAIS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={value[key]}
            disabled={disabled}
            onChange={() => onChange({ ...value, [key]: !value[key] })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
