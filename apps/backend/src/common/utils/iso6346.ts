// eslint-disable-next-line @typescript-eslint/no-require-imports
const ContainerValidator = require('container-validator') as new () => {
  isValid: (code: string) => boolean;
};

/** Valida número de contêiner ISO 6346 (inclui dígito verificador). */
export function isValidIso6346(raw: string): boolean {
  const code = raw.replace(/\s/g, '').toUpperCase();
  if (code.length !== 11) return false;
  const validator = new ContainerValidator();
  return validator.isValid(code);
}
