import { IsEmail, MaxLength } from 'class-validator';

export class EnviarEmailTesteDto {
  /** Destinatário do e-mail de teste. */
  @IsEmail()
  @MaxLength(255)
  destinatario!: string;
}
