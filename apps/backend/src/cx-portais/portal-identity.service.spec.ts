import { ConfigService } from '@nestjs/config';
import { Role, TipoCliente } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../common/email/email.service';
import { PasswordPolicyService } from '../common/security/password-policy.service';
import { AddressService } from '../common/address/address.service';
import { PrismaService } from '../prisma/prisma.service';
import type { PortalFornecedorIdentitiesStore } from './stores/portal-fornecedor-identities.store';
import { PortalJwtService } from './identity/portal-jwt.service';
import { PortalIdentityService } from './identity/portal-identity.service';
import { SessionService } from '../auth/session/session.service';
import { DeviceService } from '../auth/session/device.service';
import { LoginTelemetryService } from '../security-center/login-telemetry.service';
import { PessoasAutorizadasService } from '../pessoas-autorizadas/pessoas-autorizadas.service';

const DOC_CLIENTE = '11000000000108';
const DOC_FORNECEDOR = '11000000000299';

function makeSvc(
  prisma: PrismaService,
  fornecedores: PortalFornecedorIdentitiesStore,
  portalJwt: PortalJwtService,
) {
  const config = { get: jest.fn().mockReturnValue('7d') } as unknown as ConfigService;
  const passwordPolicy = {} as PasswordPolicyService;
  const emailService = {} as EmailService;
  const addressService = {} as AddressService;
  const session = {
    registerSession: jest.fn().mockResolvedValue({ sessionId: 'sid-test' }),
    assertSessionValid: jest.fn().mockResolvedValue(true),
  } as unknown as SessionService;
  const device = {
    extractHeaders: jest.fn().mockReturnValue({}),
    computeFingerprint: jest.fn().mockReturnValue('deadbeef'.repeat(8)),
  } as unknown as DeviceService;
  const loginTelemetry = { record: jest.fn() } as unknown as LoginTelemetryService;
  const pessoasAutorizadas = {
    criarEmLote: jest.fn(),
    validarPessoaPorCpf: jest.fn(),
  } as unknown as PessoasAutorizadasService;
  const termosUso = {
    resolveVersaoAtiva: jest.fn().mockResolvedValue('v1.0-2026'),
    getAtivo: jest.fn(),
  } as unknown as import('../common/legal/termos-uso.service').TermosUsoService;
  const dominioValidator = {
    validar: jest.fn().mockResolvedValue('INDISPONIVEL'),
  } as unknown as import('../common/validation/dominio-corporativo-validator.service').DominioCorporativoValidatorService;
  const transportadorasAutorizadas = {
    criarEmLoteNoCadastro: jest.fn(),
  } as unknown as import('../transportadoras-autorizadas/transportadoras-autorizadas.service').TransportadorasAutorizadasService;
  const tenantConfig = {
    getParametrosSeguranca: jest.fn().mockResolvedValue({ validarDominioCorporativo: true }),
  } as unknown as import('../tenant/tenant-config.service').TenantConfigService;
  return new PortalIdentityService(
    prisma,
    fornecedores,
    portalJwt,
    config,
    passwordPolicy,
    emailService,
    addressService,
    session,
    device,
    loginTelemetry,
    pessoasAutorizadas,
    termosUso,
    dominioValidator,
    transportadorasAutorizadas,
    tenantConfig,
  );
}

describe('PortalIdentityService', () => {
  it('login CLIENTE valida papel Prisma', async () => {
    const hash = await bcrypt.hash('x', 10);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          cpfCnpj: DOC_CLIENTE,
          email: 'c@t.com',
          password: hash,
          role: Role.CLIENTE,
          clienteId: 'cl1',
          tokenVersion: 0,
        }),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cl1',
          tipo: TipoCliente.PJ,
          razaoSocial: 'Cliente Teste',
          nomeFantasia: 'CT',
          cpfCnpj: '11000000000108',
        }),
      },
    } as unknown as PrismaService;
    const fornecedores = {
      onModuleInit: jest.fn(),
      validarSenha: jest.fn(),
      obterPorId: jest.fn(),
    } as unknown as PortalFornecedorIdentitiesStore;
    const portalJwt = {
      signAccess: jest.fn().mockReturnValue('a'),
      signRefresh: jest.fn().mockReturnValue('r'),
    } as unknown as PortalJwtService;
    const svc = makeSvc(prisma, fornecedores, portalJwt);
    const req = { ip: '127.0.0.1', socket: {}, get: () => 'jest' } as never;
    const r = await svc.login(DOC_CLIENTE, 'x', 'CLIENTE', 'default', req);
    expect(r.accessToken).toBe('a');
    if (r.portalPapel === 'CLIENTE') {
      expect(r.tipo).toBe(TipoCliente.PJ);
      expect(r.cliente?.nomeFantasia).toBe('CT');
      expect(r.cliente?.razaoSocial).toBe('Cliente Teste');
      expect(r.usuario?.nome).toBe('');
    }
  });

  it('login FORNECEDOR exige seed', async () => {
    const fornecedores = {
      validarSenha: jest.fn().mockResolvedValue({
        id: 'f1',
        email: 'f@t.com',
        cpfCnpj: DOC_FORNECEDOR,
        passwordHash: 'hash',
        tenantId: 'default',
        papel: 'FORNECEDOR',
        tokenVersion: 0,
      }),
      obterPorId: jest.fn(),
    } as unknown as PortalFornecedorIdentitiesStore;
    const prisma = { user: { findUnique: jest.fn() } } as unknown as PrismaService;
    const portalJwt = {
      signAccess: jest.fn().mockReturnValue('a'),
      signRefresh: jest.fn().mockReturnValue('r'),
    } as unknown as PortalJwtService;
    const svc = makeSvc(prisma, fornecedores, portalJwt);
    const r = await svc.login(DOC_FORNECEDOR, 'pwd', 'FORNECEDOR');
    expect(r.portalPapel).toBe('FORNECEDOR');
  });
});
