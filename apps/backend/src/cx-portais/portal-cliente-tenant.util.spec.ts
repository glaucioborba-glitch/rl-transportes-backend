import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  assertClienteDoTenant,
  assertTenantDaSessao,
} from './portal-cliente-tenant.util';
import type { CxPortalRequestUser } from './types/cx-portal.types';

describe('assertClienteDoTenant', () => {
  it('retorna o id quando o cliente pertence ao tenant', async () => {
    const prisma = {
      cliente: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1' }),
      },
    };
    await expect(assertClienteDoTenant(prisma, 't1', 'c1')).resolves.toBe('c1');
  });

  it('não revela existência de cliente de outro tenant', async () => {
    const prisma = {
      cliente: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    await expect(assertClienteDoTenant(prisma, 't1', 'c-outro')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('assertTenantDaSessao', () => {
  const cx = { tenantId: 'default', portalPapel: 'STAFF' } as CxPortalRequestUser;

  it('usa o tenant da sessão', () => {
    expect(assertTenantDaSessao(cx)).toBe('default');
    expect(assertTenantDaSessao(cx, 'default')).toBe('default');
  });

  it('recusa query string de outro tenant', () => {
    expect(() => assertTenantDaSessao(cx, 'outro')).toThrow(BadRequestException);
  });
});
