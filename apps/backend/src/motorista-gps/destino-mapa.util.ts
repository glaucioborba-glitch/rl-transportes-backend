export type DestinoMapaCandidato = {
  id: string;
  tipo: string;
  lat: number | null;
  lng: number | null;
};

/** Destino do ETA: o escolhido na tela, senão o terminal cadastrado, senão o primeiro com coordenada. */
export function escolherDestinoMapa<T extends DestinoMapaCandidato>(
  destinos: T[],
  destinoId?: string | null,
): T | null {
  const comPonto = destinos.filter((d) => d.lat != null && d.lng != null);
  if (comPonto.length === 0) return null;
  const pedido = destinoId?.trim();
  if (pedido) {
    const hit = comPonto.find((d) => d.id === pedido);
    if (hit) return hit;
  }
  return comPonto.find((d) => d.tipo === 'TERMINAL') ?? comPonto[0];
}
