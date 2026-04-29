import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PortalFornecedorIdentitiesStore } from './stores/portal-fornecedor-identities.store';
import { PortalJwtService } from './identity/portal-jwt.service';
import { PortalIdentityService } from './identity/portal-identity.service';

describe('PortalIdentityService', () => {
  it('login CLIENTE valida papel Prisma', async () => {
    const hash = await bcrypt.hash('x', 10);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'c@t.com',
          password: hash,
          role: Role.CLIENTE,
          clienteId: 'cl1',
          tokenVersion: 0,
        }),
      },
    } as unknown as PrismaService;
    const fornecedores = new PortalFornecedorIdentitiesStore();
    await fornecedores.onModuleInit();
    const portalJwt = {
      signAccess: jest.fn().mockReturnValue('a'),
      signRefresh: jest.fn().mockReturnValue('r'),
    } as unknown as PortalJwtService;
    const svc = new PortalIdentityService(prisma, fornecedores, portalJwt);
    const r = await svc.login('c@t.com', 'x', 'CLIENTE', 'default');
    expect(r.accessToken).toBe('a');
  });

  it('login FORNECEDOR exige seed', async () => {
    process.env.CX_PORTAL_FORNECEDOR_SEED = 'f@t.com|pwd|default';
    const fornecedores = new PortalFornecedorIdentitiesStore();
    await fornecedores.onModuleInit();
    const prisma = { user: { findUnique: jest.fn() } } as unknown as PrismaService;
    const portalJwt = {
      signAccess: jest.fn().mockReturnValue('a'),
      signRefresh: jest.fn().mockReturnValue('r'),
    } as unknown as PortalJwtService;
    const svc = new PortalIdentityService(prisma, fornecedores, portalJwt);
    const r = await svc.login('f@t.com', 'pwd', 'FORNECEDOR');
    expect(r.portalPapel).toBe('FORNECEDOR');
    delete process.env.CX_PORTAL_FORNECEDOR_SEED;
  });
});
