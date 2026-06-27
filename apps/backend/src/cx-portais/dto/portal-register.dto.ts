import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CreateClienteDto } from '../../clientes/dto/create-cliente.dto';
import { CreatePessoaAutorizadaDto } from '../../pessoas-autorizadas/dto/create-pessoa-autorizada.dto';

/** Cadastro portal = dados fiscais completos + senha (mesmo núcleo que POST /clientes). */
export class PortalRegisterDto extends CreateClienteDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    required: false,
    type: [CreatePessoaAutorizadaDto],
    description: 'Pessoas autorizadas a operar com o login corporativo (PF ou PJ).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePessoaAutorizadaDto)
  pessoasAutorizadas?: CreatePessoaAutorizadaDto[];
}
