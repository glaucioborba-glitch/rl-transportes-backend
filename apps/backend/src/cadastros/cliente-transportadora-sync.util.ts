export type ClienteParaTransportadora = {
  tenantId?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cpfCnpj?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  email?: string | null;
  telefone?: string | null;
  responsavelTelefone?: string | null;
  enderecoCep?: string | null;
  enderecoLogradouro?: string | null;
  enderecoNumero?: string | null;
  enderecoComplemento?: string | null;
  enderecoBairro?: string | null;
  enderecoCidade?: string | null;
  enderecoUf?: string | null;
  condicaoPagamento?: string | null;
};

function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function digits(value: unknown): string {
  return str(value).replace(/\D/g, '');
}

/** Preenche só o que a ficha operacional ainda não tem (RNTRC/frota ficam intactos). */
export function mergeDadosTransportadoraFromCliente(
  current: Record<string, unknown>,
  fromCliente: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(fromCliente)) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    const cur = next[key];
    if (cur == null || cur === '' || (Array.isArray(cur) && cur.length === 0)) {
      next[key] = value;
    }
  }
  return next;
}

export function mapClienteToTransportadoraStub(cliente: ClienteParaTransportadora) {
  const cnpj = digits(cliente.cpfCnpj ?? cliente.cnpj);
  const telefone = digits(cliente.telefone) || digits(cliente.responsavelTelefone);
  return {
    tenantId: str(cliente.tenantId) || 'default',
    razaoSocial: str(cliente.razaoSocial),
    nomeFantasia: str(cliente.nomeFantasia) || null,
    cnpj,
    ie: str(cliente.inscricaoEstadual) || null,
    email: str(cliente.email) || null,
    telefone: telefone || null,
    cidade: str(cliente.enderecoCidade) || null,
    uf: str(cliente.enderecoUf).toUpperCase().slice(0, 2) || null,
    dadosFromCliente: {
      celular: digits(cliente.responsavelTelefone),
      cep: digits(cliente.enderecoCep),
      endereco: str(cliente.enderecoLogradouro),
      numero: str(cliente.enderecoNumero),
      complemento: str(cliente.enderecoComplemento),
      bairro: str(cliente.enderecoBairro),
      condicaoPagamento: str(cliente.condicaoPagamento),
    },
  };
}
