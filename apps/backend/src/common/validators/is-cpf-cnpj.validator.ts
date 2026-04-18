import { TipoCliente } from '@prisma/client';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  onlyDigits,
  validateCnpjDigits,
  validateCpfDigits,
} from '../utils/br-documents';

@ValidatorConstraint({ name: 'IsCpfCnpj', async: false })
export class IsCpfCnpjConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    const obj = args.object as { tipo?: TipoCliente };
    const digits = onlyDigits(value);
    if (!obj.tipo) return false;
    if (obj.tipo === TipoCliente.PF) {
      return digits.length === 11 && validateCpfDigits(digits);
    }
    return digits.length === 14 && validateCnpjDigits(digits);
  }

  defaultMessage(): string {
    return 'CPF ou CNPJ inválido para o tipo informado';
  }
}

export function IsCpfCnpj(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCpfCnpjConstraint,
    });
  };
}
