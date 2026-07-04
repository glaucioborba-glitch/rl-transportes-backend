import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const CONDICOES_PAGAMENTO_CADASTRO = ['FATURAMENTO', 'AVISTA_PIX'] as const;

// TODO FASE 02: Substituir opções fixas por tabela CondicaoPagamentoPersonalizada

export type CondicaoPagamentoCadastro = (typeof CONDICOES_PAGAMENTO_CADASTRO)[number];

export class AprovarCadastroFinanceiroDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([...CONDICOES_PAGAMENTO_CADASTRO])
  condicaoPagamento!: CondicaoPagamentoCadastro;
}

export class RejeitarCadastroFinanceiroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}
