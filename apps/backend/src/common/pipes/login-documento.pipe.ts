import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { CorporateCpfCnpjPipe } from '../../corporate-auth/validators/corporate-cpf-cnpj.pipe';

/** @deprecated Use CorporateCpfCnpjPipe — mantido para mobile-hub. */
@Injectable()
export class LoginDocumentoPipe implements PipeTransform {
  private readonly corporate = new CorporateCpfCnpjPipe();

  transform(body: Record<string, unknown>) {
    return this.corporate.transform(body);
  }
}
