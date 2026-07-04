import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Equals, IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CreateClienteDto } from '../../clientes/dto/create-cliente.dto';
import { CreatePessoaAutorizadaDto } from '../../pessoas-autorizadas/dto/create-pessoa-autorizada.dto';
import { CreateTransportadoraCadastroPortalDto } from '../../transportadoras-autorizadas/dto/create-transportadora-cadastro-portal.dto';

/** Cadastro portal = dados fiscais completos + senha (mesmo núcleo que POST /clientes). */
export class PortalRegisterDto extends CreateClienteDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ description: 'Aceite obrigatório dos Termos de Uso e Condições Gerais.' })
  @IsBoolean()
  @Equals(true, { message: 'É necessário aceitar os Termos de Uso e Condições Gerais.' })
  aceiteTermos!: boolean;

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

  @ApiProperty({
    required: false,
    type: [CreateTransportadoraCadastroPortalDto],
    description: 'Transportadoras terceiras (CNPJ) autorizadas a operar em nome do cliente.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransportadoraCadastroPortalDto)
  transportadorasAutorizadas?: CreateTransportadoraCadastroPortalDto[];
}
