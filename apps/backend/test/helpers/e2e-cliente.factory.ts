import { Prisma, TipoCliente } from '@prisma/client';

/**
 * Payload Prisma mínimo e válido para `Cliente` em testes e2e (campos NFS-e).
 * Sempre sobrescreva `cpfCnpj` e `email` (e `emailNfse` quando necessário) para unicidade.
 */
export function clienteE2eDefaults(
  overrides: Partial<Prisma.ClienteCreateInput> = {},
): Prisma.ClienteCreateInput {
  return {
    razaoSocial: 'E2E Transportes LTDA',
    nomeFantasia: 'E2E Fantasia',
    tipo: TipoCliente.PJ,
    cpfCnpj: '00000000000191',
    email: 'cliente-e2e-default@local.test',
    emailNfse: 'nfse-e2e-default@local.test',
    telefone: '47999999999',
    enderecoLogradouro: 'Rua Teste',
    enderecoNumero: '100',
    enderecoBairro: 'Centro',
    enderecoCidade: 'Florianópolis',
    enderecoUf: 'SC',
    enderecoCep: '88010000',
    codigoMunicipioIbge: '4205407',
    responsavel: 'Responsável E2E',
    responsavelTelefone: '47988887777',
    responsavelEmail: 'resp-e2e@local.test',
    isentoIE: false,
    ...overrides,
  };
}
