import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsObject, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { INTEGRACAO_EVENTOS } from '../integracao-events.constants';

const EV = [...INTEGRACAO_EVENTOS] as string[];

export class RegisterWebhookDto {
  @ApiProperty({ example: 'https://partner.example.com/hooks/rl' })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty({ description: 'Segredo para HMAC-SHA256 das entregas' })
  @IsString()
  @MinLength(16)
  secret!: string;

  @ApiProperty({
    enum: INTEGRACAO_EVENTOS,
    isArray: true,
    example: ['gate.registrado', 'boleto.pago'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(EV, { each: true })
  eventos!: string[];
}

export class DispatchEventoInternoDto {
  @ApiProperty({ enum: INTEGRACAO_EVENTOS })
  @IsIn(EV)
  tipo!: string;

  @ApiProperty({ description: 'Payload JSON do evento', type: 'object', additionalProperties: true })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clienteId?: string;
}
