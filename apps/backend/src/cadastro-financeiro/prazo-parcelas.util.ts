export const MAX_PARCELAS_PRAZO = 12;
export const MAX_DIAS_VENCIMENTO = 3650;

/** Aceita [7,14,21], "7/14/21" ou "7, 14, 21". */
export function parseVencimentosInput(raw: unknown): number[] | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return [Math.floor(raw)];
  if (Array.isArray(raw)) {
    return raw.map((item) => Number(item)).filter((n) => Number.isFinite(n)).map((n) => Math.floor(n));
  }
  if (typeof raw === 'string') {
    const parts = raw
      .split(/[/,;]+|\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return undefined;
    return parts.map((p) => Math.floor(Number(p))).filter((n) => Number.isFinite(n));
  }
  return undefined;
}

export function normalizeVencimentos(raw: unknown): number[] {
  const parsed = parseVencimentosInput(raw) ?? [];
  return parsed;
}

export function assertVencimentosValidos(dias: number[]): number[] {
  if (!dias.length) {
    throw new Error('Informe pelo menos um vencimento (0 = à vista).');
  }
  if (dias.length > MAX_PARCELAS_PRAZO) {
    throw new Error(`No máximo ${MAX_PARCELAS_PRAZO} parcelas.`);
  }
  for (let i = 0; i < dias.length; i++) {
    const n = dias[i];
    if (!Number.isInteger(n) || n < 0 || n > MAX_DIAS_VENCIMENTO) {
      throw new Error(`Vencimento da parcela ${i + 1} inválido (use 0 a ${MAX_DIAS_VENCIMENTO} dias).`);
    }
    if (i > 0 && n <= dias[i - 1]) {
      throw new Error('Os vencimentos devem ser crescentes (ex.: 7 / 14 / 21).');
    }
  }
  return dias;
}

/** Rateia o total em N parcelas (centavos). A última absorve o residual. */
export function ratearValorEmParcelas(valorTotal: number, quantidade: number): number[] {
  const n = Math.max(1, Math.floor(quantidade));
  const cents = Math.round(Number(valorTotal) * 100);
  const base = Math.floor(cents / n);
  const resto = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i === n - 1 ? resto : 0)) / 100);
}

export function addDiasCorridos(emissao: Date, dias: number): Date {
  const d = new Date(emissao);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

export type ParcelaFinanceira = {
  indice: number;
  totalParcelas: number;
  dias: number;
  valor: number;
  vencimento: Date;
};

export function montarParcelasFinanceiras(input: {
  emissao: Date;
  valorTotal: number;
  vencimentos: number[];
}): ParcelaFinanceira[] {
  const vencimentos = assertVencimentosValidos(input.vencimentos);
  const valores = ratearValorEmParcelas(input.valorTotal, vencimentos.length);
  return vencimentos.map((dias, i) => ({
    indice: i + 1,
    totalParcelas: vencimentos.length,
    dias,
    valor: valores[i] ?? 0,
    vencimento: addDiasCorridos(input.emissao, dias),
  }));
}

export function formatVencimentosLabel(vencimentos: number[] | null | undefined): string {
  if (!vencimentos?.length) return '—';
  return vencimentos.join(' / ');
}
