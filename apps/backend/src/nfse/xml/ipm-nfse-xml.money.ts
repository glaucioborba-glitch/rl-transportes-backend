/**
 * Valores reais com vírgula decimal e ponto de milhar (NTE-35, exportação 430).
 */
export function formatBrReal(value: number, decimals = 2): string {
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withSep},${decPart}`;
}
