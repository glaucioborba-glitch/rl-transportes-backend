"use client";

import { Input } from "@/components/ui/input";
import { formatContainerISO } from "@/utils/containerFormatter";
import { TAMANHOS_PERMITIDOS, TIPOS_CONTAINER_PERMITIDOS } from "@/utils/container-options";

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  selectClassName: string;
};

export function ContainerIsoInput({
  value,
  onChange,
  required,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(formatContainerISO(e.target.value))}
      placeholder="AAAA 000000-0"
      required={required}
      disabled={disabled}
      readOnly={disabled}
      className={className}
      inputMode="text"
      autoCapitalize="characters"
      spellCheck={false}
    />
  );
}

export function ContainerTamanhoSelect({ value, onChange, required, selectClassName }: SelectProps) {
  return (
    <select
      className={selectClassName}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">Selecione…</option>
      {TAMANHOS_PERMITIDOS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

export function ContainerTipoSelect({ value, onChange, required, selectClassName }: SelectProps) {
  return (
    <select
      className={selectClassName}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">Selecione…</option>
      {TIPOS_CONTAINER_PERMITIDOS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
