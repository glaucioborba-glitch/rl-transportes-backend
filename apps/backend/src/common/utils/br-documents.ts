/** Normaliza documento brasileiro para somente dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Valida CPF (11 dígitos, módulo 11, rejeita sequências repetidas). */
export function validarCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(.)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[9], 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(cpf[10], 10);
}

/** Valida CNPJ (14 dígitos, módulo 11, rejeita sequências repetidas). */
export function validarCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(.)\1{13}$/.test(cnpj)) return false;

  let tamanho = 12;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  tamanho = 13;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return resultado === parseInt(digitos.charAt(1), 10);
}

/** @alias validarCPF */
export const validateCpfDigits = validarCPF;

/** @alias validarCNPJ */
export const validateCnpjDigits = validarCNPJ;

/** Máscara de exibição/auditoria: 000.000.000-00 */
export function maskCpfDisplay(cpf: string): string {
  const d = onlyDigits(cpf).slice(-11).padStart(11, '0');
  if (d.length !== 11) return cpf;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
