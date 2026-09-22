export function parseCpfBiometria(cpf: string): string | null {
  const digits = (cpf ?? '').replace(/\D/g, '');
  return digits.length === 11 ? digits : null;
}

export function isLikelyFirText(value: string): boolean {
  const v = (value ?? '').trim();
  if (v.length < 32) return false;
  if (v.startsWith('data:')) return false;
  return true;
}
