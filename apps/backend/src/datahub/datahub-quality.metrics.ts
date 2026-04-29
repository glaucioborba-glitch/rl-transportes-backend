/** Métricas de qualidade reutilizáveis (testáveis sem Prisma). */

export function taxaCompletudeCampos<T extends Record<string, unknown>>(
  linhas: T[],
  campos: (keyof T)[],
): number {
  if (linhas.length === 0 || campos.length === 0) return 1;
  let ok = 0;
  let total = 0;
  for (const row of linhas) {
    for (const f of campos) {
      total++;
      const v = row[f];
      if (v !== null && v !== undefined && v !== '') ok++;
    }
  }
  return Math.round((ok / total) * 1000) / 1000;
}

export function taxaDuplicidadePorChave<T>(linhas: T[], chave: (row: T) => string): number {
  if (linhas.length === 0) return 0;
  const map = new Map<string, number>();
  for (const row of linhas) {
    const k = chave(row);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  let dup = 0;
  for (const v of map.values()) {
    if (v > 1) dup += v - 1;
  }
  return Math.round((dup / linhas.length) * 1000) / 1000;
}

export function consistenciaTemporalViolacoes(datas: Array<{ ini: Date; fim: Date }>): number {
  let n = 0;
  for (const { ini, fim } of datas) {
    if (fim.getTime() < ini.getTime()) n++;
  }
  return n;
}

/** `sk_cliente` válidos na dimensão de clientes (DW em memória). */
export function extrairSkClientesDim(
  dimRows: Record<string, unknown>[] | undefined,
): Set<string> {
  const s = new Set<string>();
  if (!dimRows?.length) return s;
  for (const r of dimRows) {
    const sk = r['sk_cliente'];
    if (sk != null && sk !== '') s.add(String(sk));
  }
  return s;
}

/**
 * Conta linhas de fato cujo `fk_cliente` não existe em `DIM_Clientes` após o load —
 * proxy de chaves órfãs no star schema simulado.
 */
export function contarFkClienteOrfasNosFatos(
  fatos: Partial<Record<string, Record<string, unknown>[] | undefined>>,
  skClientesValidos: Set<string>,
): number {
  let n = 0;
  for (const rows of Object.values(fatos)) {
    if (!rows?.length) continue;
    for (const row of rows) {
      const fk = row['fk_cliente'];
      if (fk === undefined || fk === null) continue;
      if (!skClientesValidos.has(String(fk))) n++;
    }
  }
  return n;
}
