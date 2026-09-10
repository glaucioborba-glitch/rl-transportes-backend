export const CLIENTE_PAPEIS_OPCOES = ['CLIENTE', 'TRANSPORTADOR'] as const;

export type ClientePapel = (typeof CLIENTE_PAPEIS_OPCOES)[number];

export function normalizeClientePapeis(values: unknown): ClientePapel[] {
  const raw = Array.isArray(values) ? values : [];
  const seen = new Set<ClientePapel>();
  for (const item of raw) {
    const n = String(item ?? '')
      .trim()
      .toUpperCase();
    if (n === 'CLIENTE' || n === 'TRANSPORTADOR') seen.add(n);
  }
  return CLIENTE_PAPEIS_OPCOES.filter((p) => seen.has(p));
}

export function defaultClientePapeis(values: unknown): ClientePapel[] {
  const next = normalizeClientePapeis(values);
  return next.length ? next : ['CLIENTE'];
}

export function clienteTemPapelTransportador(values: unknown): boolean {
  return normalizeClientePapeis(values).includes('TRANSPORTADOR');
}
