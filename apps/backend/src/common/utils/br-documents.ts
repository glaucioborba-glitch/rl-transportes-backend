/** Normaliza documento brasileiro para somente dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function cpfDigit(base: string, weightStart: number): number {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    sum += parseInt(base[i], 10) * (weightStart - i);
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Valida CPF (11 dígitos, dígitos verificadores módulo 11). */
export function validateCpfDigits(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const d1 = cpfDigit(digits.slice(0, 9), 10);
  const d2 = cpfDigit(digits.slice(0, 10), 11);
  return d1 === parseInt(digits[9], 10) && d2 === parseInt(digits[10], 10);
}

function cnpjCalcDigit(base: string, factors: number[]): number {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    sum += parseInt(base[i], 10) * factors[i];
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

/** Valida CNPJ (14 dígitos). */
export function validateCnpjDigits(digits: string): boolean {
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const f1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const f2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = cnpjCalcDigit(digits.slice(0, 12), f1);
  const d2 = cnpjCalcDigit(digits.slice(0, 13), f2);
  return d1 === parseInt(digits[12], 10) && d2 === parseInt(digits[13], 10);
}
