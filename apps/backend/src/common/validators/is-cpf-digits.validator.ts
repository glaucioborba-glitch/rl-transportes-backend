import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

function isValidCpfDigits(cpf: string): boolean {
  if (cpf.length !== 11 || cpf === cpf[0].repeat(11)) return false;

  const digits = cpf.split('').map(Number);

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  const remainder1 = sum % 11;
  const digit1 = remainder1 < 2 ? 0 : 11 - remainder1;
  if (digits[9] !== digit1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  const remainder2 = sum % 11;
  const digit2 = remainder2 < 2 ? 0 : 11 - remainder2;

  return digits[10] === digit2;
}

@ValidatorConstraint({ name: 'IsCpfDigits', async: false })
export class IsCpfDigitsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    const clean = value.replace(/\D/g, '');
    return clean.length === 11 && isValidCpfDigits(clean);
  }

  defaultMessage(): string {
    return 'CPF inválido. Verifique os dígitos.';
  }
}

/** Valida CPF com dígitos verificadores (entrada pode estar mascarada). */
export function IsCpfDigits(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCpfDigitsConstraint,
    });
  };
}
