/** Interseção tenant × API Key. Lista vazia = nenhum cliente (não é “todos”). */
export function mergePlataformaClienteIds(
  tenantClienteIds: string[] | undefined,
  keyClienteIds: string[] | undefined,
): string[] {
  const tIds = tenantClienteIds?.length ? tenantClienteIds : undefined;
  const kIds = keyClienteIds?.length ? keyClienteIds : undefined;
  if (tIds && kIds) return kIds.filter((id) => tIds.includes(id));
  return tIds ?? kIds ?? [];
}
