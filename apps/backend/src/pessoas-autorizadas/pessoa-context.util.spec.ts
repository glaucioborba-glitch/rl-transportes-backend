import { buildPessoaAuditMeta, extractPessoaResponsavelFromAudit } from './pessoa-context.util';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';

describe('pessoa-context.util', () => {
  const cx: CxPortalRequestUser = {
    sub: 'user-1',
    email: 'corp@empresa.com',
    cpfCnpj: '12.345.678/0001-99',
    portalPapel: 'CLIENTE',
    tenantId: 'default',
    clienteId: 'cli-1',
    tokenVersion: 0,
    auth: 'portal',
    sid: 'sid-1',
    pessoaAutorizada: {
      id: 'p1',
      nome: 'Ana Silva',
      email: 'ana@empresa.com',
      telefone: '48999999999',
    },
  };

  it('auditoria → delta inclui pessoa e permissaoUsada', () => {
    const meta = buildPessoaAuditMeta(cx, undefined, 'criarSolicitacao');
    expect(meta).toMatchObject({
      pessoaId: 'p1',
      nome: 'Ana Silva',
      permissaoUsada: 'criarSolicitacao',
    });
  });

  it('extrai pessoaResponsavel de dadosDepois auditados', () => {
    const pessoa = extractPessoaResponsavelFromAudit({
      record: {
        v2: true,
        pessoaResponsavel: {
          id: 'p1',
          nome: 'Ana',
          email: 'a@x.com',
          telefone: '48999999999',
        },
      },
    });
    expect(pessoa?.id).toBe('p1');
  });
});
