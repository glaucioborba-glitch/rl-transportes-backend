"use client";

import { Input } from "@/components/ui/input";
import { formatContainerISO } from "@/utils/containerFormatter";
import {
  formatTamanhoContainerDisplay,
  normalizeTamanhoContainer,
} from "@/lib/cadastros/tipo-container-tamanhos";
import type { PortalTipoContainerCatalogItem } from "@/lib/api/portal-client";

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  selectClassName: string;
  disabled?: boolean;
};

export function ContainerIsoInput({
  value,
  onChange,
  required,
  disabled,
  className,
  onIsoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onIsoComplete?: (iso: string) => void;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => {
        const formatted = formatContainerISO(e.target.value);
        onChange(formatted);
        const iso = formatted.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (iso.length === 11) onIsoComplete?.(iso);
      }}
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

/** Status de carga do contêiner na solicitação (não confundir com ativo/inativo do cadastro). */
export const STATUS_CONTAINER_CARGA = [
  { value: "CHEIO", label: "Cheio" },
  { value: "VAZIO", label: "Vazio" },
] as const;

export function ContainerStatusSelect({ value, onChange, required, selectClassName }: SelectProps) {
  return (
    <select
      className={selectClassName}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      {STATUS_CONTAINER_CARGA.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

/** Tomada reefer: Sim = conectar/cobrar energia; Não = só armazenagem. */
export function ContainerRefrigeradoSelect({
  value,
  onChange,
  required,
  selectClassName,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  required?: boolean;
  selectClassName: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={selectClassName}
      value={value ? "sim" : "nao"}
      onChange={(e) => onChange(e.target.value === "sim")}
      required={required}
      disabled={disabled}
    >
      <option value="nao">Não</option>
      <option value="sim">Sim</option>
    </select>
  );
}

export function ContainerTipoSelect({
  value,
  onChange,
  required,
  selectClassName,
  tipos,
  disabled,
}: SelectProps & { tipos: PortalTipoContainerCatalogItem[] }) {
  return (
    <select
      className={selectClassName}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled || tipos.length === 0}
    >
      <option value="">Selecione…</option>
      {tipos.map((t) => (
        <option key={t.codigo} value={t.codigo}>
          {t.codigo} — {t.nome}
        </option>
      ))}
    </select>
  );
}

export function ContainerTamanhoSelect({
  value,
  onChange,
  required,
  selectClassName,
  tamanhos,
  disabled,
}: SelectProps & { tamanhos: string[] }) {
  const normalizedValue = normalizeTamanhoContainer(value);
  const options = tamanhos.map((t) => normalizeTamanhoContainer(t)).filter(Boolean);

  return (
    <select
      className={selectClassName}
      value={options.includes(normalizedValue) ? normalizedValue : ""}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled || options.length === 0}
    >
      <option value="">Selecione…</option>
      {options.map((t) => (
        <option key={t} value={t}>
          {formatTamanhoContainerDisplay(t)}
        </option>
      ))}
    </select>
  );
}

export function findPortalTipo(
  tipos: PortalTipoContainerCatalogItem[],
  codigo: string,
): PortalTipoContainerCatalogItem | undefined {
  const key = codigo.trim().toUpperCase();
  return tipos.find((t) => t.codigo.toUpperCase() === key);
}
