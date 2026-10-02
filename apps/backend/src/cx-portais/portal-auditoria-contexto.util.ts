import type { CxPortalRequestUser } from './types/cx-portal.types';

export function contextoAuditoriaPortal(
  u: CxPortalRequestUser,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    portal: true,
    tipo: 'PORTAL',
    portalPapel: u.portalPapel,
    clienteId: u.clienteId ?? null,
    cnpj: u.cpfCnpj,
    operadorNome: u.pessoaAutorizada?.nome?.trim() || u.email,
    operadorEmail: u.email,
    pessoaId: u.pessoaAutorizada?.id ?? null,
    ...extra,
    ator: {
      tipo: 'cliente',
      operadorNome: u.pessoaAutorizada?.nome?.trim() || u.email,
      empresaNome: typeof extra?.empresaNome === 'string' ? extra.empresaNome : null,
    },
  };
}
