import type { AuditFieldDelta } from '../../audit-log/audit-log-solicitacao.util';
import { stripContainerIsoCanonical } from './data-sanitize';

/** Campos cuja alteração invalida o QR Code da credencial do motorista. */
export const GATE_CREDENTIAL_VERSION_FIELDS = new Set([
  'placaCavalo',
  'placaCarreta01',
  'placaCarreta02',
  'nomeMotorista',
  'cpfMotorista',
  'containerIso',
]);

export function deltasInvalidateQrCredential(deltas: AuditFieldDelta[]): boolean {
  return deltas.some((d) => GATE_CREDENTIAL_VERSION_FIELDS.has(d.campo));
}

export function containerIsosChanged(before: string[], after: string[]): boolean {
  const norm = (list: string[]) =>
    [...new Set(list.map((iso) => stripContainerIsoCanonical(iso)).filter(Boolean))].sort();
  const a = norm(before);
  const b = norm(after);
  if (a.length !== b.length) return true;
  return a.some((v, i) => v !== b[i]);
}
