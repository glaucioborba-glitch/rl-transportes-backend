/** Monta query string para GET /simulador/cenario (DTO existente). */
export function buildCenarioQuery(q: {
  aumentoDemandaPercentual?: number;
  reducaoTurnoHoras?: number;
  aumentoTurnoHoras?: number;
  expansaoQuadras?: number;
  novoClienteVolumeEstimado?: number;
}): string {
  const p = new URLSearchParams();
  if (q.aumentoDemandaPercentual != null && q.aumentoDemandaPercentual !== 0) {
    p.set("aumentoDemandaPercentual", String(q.aumentoDemandaPercentual));
  }
  if (q.reducaoTurnoHoras != null && q.reducaoTurnoHoras !== 0) p.set("reducaoTurnoHoras", String(q.reducaoTurnoHoras));
  if (q.aumentoTurnoHoras != null && q.aumentoTurnoHoras !== 0) p.set("aumentoTurnoHoras", String(q.aumentoTurnoHoras));
  if (q.expansaoQuadras != null && q.expansaoQuadras !== 0) p.set("expansaoQuadras", String(q.expansaoQuadras));
  if (q.novoClienteVolumeEstimado != null && q.novoClienteVolumeEstimado !== 0) {
    p.set("novoClienteVolumeEstimado", String(q.novoClienteVolumeEstimado));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function buildExpansaoQuery(q: { quadrasAdicionais?: number; slotsPorQuadraEstimado?: number }): string {
  const p = new URLSearchParams();
  if (q.quadrasAdicionais != null && q.quadrasAdicionais !== 0) p.set("quadrasAdicionais", String(q.quadrasAdicionais));
  if (q.slotsPorQuadraEstimado != null && q.slotsPorQuadraEstimado !== 0) {
    p.set("slotsPorQuadraEstimado", String(q.slotsPorQuadraEstimado));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function buildTurnosQuery(q: { reducaoTurno?: string; aumentoTurno?: string }): string {
  const p = new URLSearchParams();
  if (q.reducaoTurno) p.set("reducaoTurno", q.reducaoTurno);
  if (q.aumentoTurno) p.set("aumentoTurno", q.aumentoTurno);
  const s = p.toString();
  return s ? `?${s}` : "";
}
