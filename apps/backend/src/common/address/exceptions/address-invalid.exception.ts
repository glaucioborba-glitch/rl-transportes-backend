import { HttpException, HttpStatus } from '@nestjs/common';

/** Erro fiscal de endereço com corpo padronizado para o front. */
export class AddressInvalidException extends HttpException {
  constructor(message: string) {
    super({ field: 'endereco', message }, HttpStatus.BAD_REQUEST);
  }
}
