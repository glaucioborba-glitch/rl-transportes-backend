import { Prisma, TipoCliente } from '@prisma/client';
import { CreateClienteDto } from './dto/create-cliente.dto';

function normalizeCpfCnpjDigits(dto: CreateClienteDto): string {
  const d = dto.cpfCnpj.replace(/\D/g, '');
  if (dto.tipo === TipoCliente.PF) return d.length <= 11 ? d.padStart(14, '0') : d;
  return d;
}

export function parseDataNascimentoPf(iso: string): Date {
  const s = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00.000Z`);
  }
  return new Date(iso);
}

function tabelaPrecoConnect(dto: CreateClienteDto): Pick<Prisma.ClienteCreateInput, 'tabelaPreco'> {
  if (!dto.tabelaPrecoId) return {};
  return { tabelaPreco: { connect: { id: dto.tabelaPrecoId } } };
}

/** Monta payload Prisma a partir do DTO (CPF/CNPJ já validado pelo pipe nos controllers). */
export function clienteCreateInputFromDto(dto: CreateClienteDto): Prisma.ClienteCreateInput {
  const cpfCnpj = normalizeCpfCnpjDigits(dto);
  const email = dto.email.trim().toLowerCase();
  const emailNfsePf = dto.emailNfse?.trim().toLowerCase() ?? email;
  const telPrincipal = dto.telefone.replace(/\D/g, '');
  const telContatoPf = dto.telefoneContato?.replace(/\D/g, '') ?? telPrincipal;

  if (dto.tipo === TipoCliente.PF) {
    const nome = dto.nomeCompleto!.trim();
    return {
      razaoSocial: nome,
      nomeFantasia: null,
      tipo: TipoCliente.PF,
      dataNascimento: dto.dataNascimento?.trim()
        ? parseDataNascimentoPf(dto.dataNascimento)
        : null,
      cpfCnpj,
      inscricaoMunicipal: null,
      inscricaoEstadual: null,
      isentoIE: false,
      email,
      emailNfse: emailNfsePf,
      telefone: telContatoPf,
      enderecoLogradouro: dto.enderecoLogradouro.trim(),
      enderecoNumero: dto.enderecoNumero.trim(),
      enderecoComplemento: dto.enderecoComplemento?.trim() || null,
      enderecoBairro: dto.enderecoBairro.trim(),
      enderecoCidade: dto.enderecoCidade.trim(),
      enderecoUf: dto.enderecoUf.trim().toUpperCase(),
      enderecoCep: dto.enderecoCep.replace(/\D/g, ''),
      codigoMunicipioIbge: (dto.codigoMunicipioIbge ?? '').replace(/\D/g, ''),
      regimeTributario: null,
      descricaoAtividade: null,
      cnae: null,
      responsavel: null,
      responsavelTelefone: null,
      responsavelEmail: null,
      ...tabelaPrecoConnect(dto),
    };
  }

  return {
    razaoSocial: dto.razaoSocial!.trim(),
    nomeFantasia: dto.nomeFantasia!.trim(),
    tipo: TipoCliente.PJ,
    dataNascimento: null,
    cpfCnpj,
    inscricaoMunicipal: dto.inscricaoMunicipal?.trim() || null,
    inscricaoEstadual: dto.inscricaoEstadual?.trim() || null,
    isentoIE: dto.isentoIE ?? false,
    email,
    emailNfse: dto.emailNfse!.trim().toLowerCase(),
    telefone: telPrincipal,
    enderecoLogradouro: dto.enderecoLogradouro.trim(),
    enderecoNumero: dto.enderecoNumero.trim(),
    enderecoComplemento: dto.enderecoComplemento?.trim() || null,
    enderecoBairro: dto.enderecoBairro.trim(),
    enderecoCidade: dto.enderecoCidade.trim(),
    enderecoUf: dto.enderecoUf.trim().toUpperCase(),
    enderecoCep: dto.enderecoCep.replace(/\D/g, ''),
    codigoMunicipioIbge: dto.codigoMunicipioIbge!.replace(/\D/g, ''),
    regimeTributario: null,
    descricaoAtividade: null,
    cnae: null,
    responsavel: dto.responsavel!.trim(),
    responsavelTelefone: dto.responsavelTelefone!.replace(/\D/g, ''),
    responsavelEmail: dto.responsavelEmail!.trim().toLowerCase(),
    ...tabelaPrecoConnect(dto),
  };
}
