import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { isValidIso6346 } from '../utils/iso6346';

@ValidatorConstraint({ name: 'IsIso6346CheckDigit', async: false })
export class IsIso6346CheckDigitConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidIso6346(value);
  }

  defaultMessage(): string {
    return 'Número ISO 6346 inválido (dígito verificador ou formato)';
  }
}

export function IsIso6346(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIso6346CheckDigitConstraint,
    });
  };
}
