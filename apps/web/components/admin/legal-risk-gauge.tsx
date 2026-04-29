import { SlaGauge } from "@/components/admin/sla-gauge";

/** Risco jurídico / compliance: maior valor = mais risco (invertido visualmente). */
export function LegalRiskGauge({ value, label }: { value: number; label: string }) {
  const inverted = 100 - Math.max(0, Math.min(100, value));
  return <SlaGauge value={inverted} label={label} hint="Quanto maior o medidor, menor o risco relativo neste proxy." />;
}
